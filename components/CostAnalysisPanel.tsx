import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../contexts/DataContext';
import { Card, CardHeader, CardTitle } from './ui/Card';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';
import { Calculator, DollarSign, Filter, Percent, Download } from 'lucide-react';
import type { FichaTecnica, Insumo } from '../types';

// Helper function
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Selections = Record<number, number[]>; // insumo_especial_id -> insumo_ids[]

interface Scenario {
    key: string;           // chave unica do cenario
    label: string;         // nome curto para o header
    // insumo_especial_id -> insumo_id selecionado nesse cenario
    picks: Record<number, number>;
}

const CostAnalysisPanel: React.FC = () => {
    const {
        produtosBase,
        fichasTecnicas,
        insumos,
        insumosEspeciais,
        insumosEspeciaisOpcoes,
        parametros,
        loading
    } = useData();

    const [selections, setSelections] = useState<Selections>({});
    const [markupKey, setMarkupKey] = useState<'markup_p1' | 'markup_p2' | 'markup_p3'>('markup_p1');

    const insumosById = useMemo(() => new Map<number, Insumo>(insumos.map(i => [i.id, i])), [insumos]);

    // Gera todos os cenarios a partir do produto cartesiano das selecoes.
    // Se o usuario selecionou [A,B] em MALHA e [X] em COURO -> 2 cenarios:
    // [MALHA=A,COURO=X] e [MALHA=B,COURO=X].
    const scenarios = useMemo<Scenario[]>(() => {
        const entries = Object.entries(selections)
            .map(([k, v]) => ({ id: parseInt(k, 10), ids: v || [] }))
            .filter(e => e.ids.length > 0);

        if (entries.length === 0) return [{ key: 'base', label: 'Sem adicional', picks: {} }];

        let combos: Record<number, number>[] = [{}];
        for (const entry of entries) {
            const next: Record<number, number>[] = [];
            for (const combo of combos) {
                for (const id of entry.ids) {
                    next.push({ ...combo, [entry.id]: id });
                }
            }
            combos = next;
        }

        return combos.map(picks => {
            const label = Object.entries(picks)
                .map(([, insumoId]) => insumosById.get(insumoId)?.nome || '?')
                .join(' + ');
            return { key: JSON.stringify(picks), label, picks };
        });
    }, [selections, insumosById]);

    const analysisData = useMemo(() => {
        if (loading || !produtosBase.length) return [];

        const fichasByProduct = fichasTecnicas.reduce<Record<number, FichaTecnica[]>>((acc, ft) => {
            if (!acc[ft.produto_base_id]) acc[ft.produto_base_id] = [];
            acc[ft.produto_base_id].push(ft);
            return acc;
        }, {});

        return produtosBase.map(produto => {
            const productFichas = fichasByProduct[produto.id] || [];

            const baseCost = productFichas
                .filter(ft => ft.insumo_id && ft.quantidade !== null)
                .reduce((sum, ft) => {
                    const insumo = insumosById.get(ft.insumo_id!);
                    return sum + ((insumo?.custo_unitario || 0) * (ft.quantidade || 0));
                }, 0);

            const markupValue = parametros?.[markupKey] || 1;

            // Para cada cenario, calcula adicional, custo total, preco e markup.
            const perScenario: Record<string, {
                adicionais: Record<number, number>; // insumo_especial_id -> custo
                totalCost: number;
                price: number;
                markup: number;
            }> = {};

            for (const sc of scenarios) {
                const adicionais: Record<number, number> = {};
                let extra = 0;

                for (const [specialIdStr, insumoId] of Object.entries(sc.picks)) {
                    const specialId = parseInt(specialIdStr, 10);
                    const ficha = productFichas.find(ft => ft.insumo_especial_id === specialId);
                    const insumo = insumosById.get(insumoId);
                    if (ficha && insumo) {
                        const quantity = ficha.quantidade ?? ficha.quantidade_adulto ?? ficha.quantidade_infantil ?? 0;
                        const cost = (insumo.custo_unitario || 0) * (quantity || 0);
                        adicionais[specialId] = cost;
                        extra += cost;
                    }
                }

                const totalCost = baseCost + extra;
                const price = produto.preco_venda_manual ?? (totalCost * markupValue);
                const markup = totalCost > 0 ? price / totalCost : 0;
                perScenario[sc.key] = { adicionais, totalCost, price, markup };
            }

            return {
                id: produto.id,
                nome: produto.nome,
                baseCost,
                perScenario,
            };
        });
    }, [produtosBase, fichasTecnicas, insumosById, scenarios, loading, parametros, markupKey]);

    const toggleSelection = (specialId: number, insumoId: number) => {
        setSelections(prev => {
            const current = prev[specialId] || [];
            const next = current.includes(insumoId)
                ? current.filter(id => id !== insumoId)
                : [...current, insumoId];
            return { ...prev, [specialId]: next };
        });
    };

    const clearSelectionsFor = (specialId: number) => {
        setSelections(prev => ({ ...prev, [specialId]: [] }));
    };

    const handleExportXLSX = () => {
        // Monta linhas "achatadas" para o Excel.
        const rows: any[] = analysisData.map(p => {
            const row: any = {
                Produto: p.nome,
                'Custo Base': p.baseCost,
            };
            for (const sc of scenarios) {
                const s = p.perScenario[sc.key];
                const label = sc.label || 'Sem adicional';
                if (scenarios.length > 1) {
                    row[`Custo Total (${label})`] = s.totalCost;
                    row[`Preço Venda (${label})`] = s.price;
                    row[`Markup (${label})`] = Number(s.markup.toFixed(4));
                } else {
                    row['Custo Total'] = s.totalCost;
                    row['Preço Venda'] = s.price;
                    row['Markup'] = Number(s.markup.toFixed(4));
                }
            }
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Analise de Custos');
        const fileName = `analise_custos_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    if (loading) {
        return <div className="flex justify-center items-center p-10"><Spinner /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Análise de Custos</h1>
                    <p className="text-slate-500 mt-1">Simule o custo final e compare opções de insumos especiais.</p>
                </div>
                <button
                    onClick={handleExportXLSX}
                    disabled={analysisData.length === 0}
                    className="flex items-center justify-center px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg shadow hover:bg-primary-700 disabled:bg-slate-400 transition-all self-start md:self-center"
                >
                    <Download size={18} className="mr-2" />
                    Exportar XLSX
                </button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Filter size={18} className="mr-2 text-primary-600" /> Filtros de Simulação</CardTitle>
                    <p className="text-sm text-slate-500 pt-1">Selecione uma ou mais opções de cada categoria para comparar cenários lado a lado.</p>
                </CardHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {insumosEspeciais.map(specialInput => {
                        const options = insumosEspeciaisOpcoes
                            .filter(opt => opt.insumo_especial_id === specialInput.id)
                            .map(opt => insumos.find(i => i.id === opt.insumo_id))
                            .filter((i): i is NonNullable<typeof i> => !!i);

                        const selected = selections[specialInput.id] || [];

                        return (
                            <div key={specialInput.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-slate-700">{specialInput.nome}</label>
                                    {selected.length > 0 && (
                                        <button onClick={() => clearSelectionsFor(specialInput.id)} className="text-xs text-slate-500 hover:text-slate-800">Limpar</button>
                                    )}
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                                    {options.length === 0 && <p className="text-xs text-slate-400">Nenhuma opção cadastrada.</p>}
                                    {options.map(insumo => (
                                        <label key={insumo.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(insumo.id)}
                                                onChange={() => toggleSelection(specialInput.id, insumo.id)}
                                                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <span className="text-slate-700">{insumo.nome}</span>
                                        </label>
                                    ))}
                                </div>
                                {selected.length > 0 && (
                                    <p className="text-xs text-primary-600 mt-2">{selected.length} selecionado(s)</p>
                                )}
                            </div>
                        );
                    })}
                    <div className="border border-slate-200 rounded-lg p-3 bg-white">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Nível de Preço (Markup)</label>
                        <select
                            value={markupKey}
                            onChange={e => setMarkupKey(e.target.value as any)}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 transition"
                        >
                            <option value="markup_p1">Preço P1 ({(parametros?.markup_p1 ?? 1).toFixed(2)}x)</option>
                            <option value="markup_p2">Preço P2 ({(parametros?.markup_p2 ?? 1).toFixed(2)}x)</option>
                            <option value="markup_p3">Preço P3 ({(parametros?.markup_p3 ?? 1).toFixed(2)}x)</option>
                        </select>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Resultado da Simulação</CardTitle>
                    {scenarios.length > 1 && (
                        <p className="text-sm text-slate-500 pt-1">Comparando {scenarios.length} cenário(s).</p>
                    )}
                </CardHeader>
                {analysisData.length === 0 ? (
                    <EmptyState icon={<Calculator size={40} />} message="Nenhum dado para analisar" description="Cadastre produtos e fichas técnicas para começar." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th rowSpan={2} className="sticky left-0 bg-slate-50 px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider z-10">Produto</th>
                                    <th rowSpan={2} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Custo Base</th>
                                    {scenarios.map(sc => (
                                        <th key={sc.key} colSpan={3} className="px-4 py-2 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider border-l border-slate-200">
                                            {sc.label || 'Sem adicional'}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    {scenarios.map(sc => (
                                        <React.Fragment key={sc.key}>
                                            <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-l border-slate-200"><Calculator size={12} className="inline mr-1" />Custo Total</th>
                                            <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><DollarSign size={12} className="inline mr-1" />Preço</th>
                                            <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider"><Percent size={12} className="inline mr-1" />Markup</th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {analysisData.map(produto => (
                                    <tr key={produto.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="sticky left-0 bg-white hover:bg-slate-50 px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 z-10">{produto.nome}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatCurrency(produto.baseCost)}</td>
                                        {scenarios.map(sc => {
                                            const s = produto.perScenario[sc.key];
                                            return (
                                                <React.Fragment key={sc.key}>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-danger-700 font-semibold border-l border-slate-200">{formatCurrency(s.totalCost)}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-success-700 font-semibold">{formatCurrency(s.price)}</td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-800 font-semibold">{s.markup.toFixed(2)}x</td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default CostAnalysisPanel;
