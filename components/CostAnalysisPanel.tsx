import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Card, CardHeader, CardTitle } from './ui/Card';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';
import { Calculator, DollarSign, Filter, Percent, Layers, Table as TableIcon } from 'lucide-react';
import type { FichaTecnica, InsumoEspecialOpcao, Insumo } from '../types';

// Helper function
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
    
    const [selections, setSelections] = useState<Record<number, string>>({});
    const [markupKey, setMarkupKey] = useState<'markup_p1' | 'markup_p2' | 'markup_p3'>('markup_p1');

    const analysisData = useMemo(() => {
        if (loading || !produtosBase.length) {
            return [];
        }

        const fichasByProduct = fichasTecnicas.reduce<Record<number, FichaTecnica[]>>((acc, ft) => {
            if (!acc[ft.produto_base_id]) acc[ft.produto_base_id] = [];
            acc[ft.produto_base_id].push(ft);
            return acc;
        }, {});

        const insumosById = new Map<number, Insumo>(insumos.map(i => [i.id, i]));

        return produtosBase.map(produto => {
            const productFichas = fichasByProduct[produto.id] || [];
            
            const baseCost = productFichas
                .filter(ft => ft.insumo_id && ft.quantidade !== null)
                .reduce((sum, ft) => {
                    const insumo = insumosById.get(ft.insumo_id!);
                    return sum + ((insumo?.custo_unitario || 0) * (ft.quantidade || 0));
                }, 0);

            let totalCost = baseCost;
            const specialCostsBreakdown: Record<number, { cost: number; name: string }> = {};

            Object.entries(selections).forEach(([specialInputIdStr, selectedInsumoIdStr]) => {
                if (!selectedInsumoIdStr) return; 

                const specialInputId = parseInt(specialInputIdStr, 10);
                const selectedInsumoId = parseInt(String(selectedInsumoIdStr), 10);

                const fichaForItem = productFichas.find(ft => ft.insumo_especial_id === specialInputId);
                const selectedInsumo = insumosById.get(selectedInsumoId);

                if (fichaForItem && selectedInsumo) {
                    let quantity = fichaForItem.quantidade ?? fichaForItem.quantidade_adulto ?? fichaForItem.quantidade_infantil ?? 0;
                    const addedCost = (selectedInsumo.custo_unitario || 0) * (quantity || 0);
                    totalCost += addedCost;
                    specialCostsBreakdown[specialInputId] = { cost: addedCost, name: selectedInsumo.nome };
                }
            });

            const markupValue = parametros?.[markupKey] || 1;
            const simulatedPrice = produto.preco_venda_manual ?? (totalCost * markupValue);
            const simulatedMarkup = totalCost > 0 ? simulatedPrice / totalCost : 0;

            return {
                id: produto.id,
                nome: produto.nome,
                baseCost,
                specialCostsBreakdown,
                totalCost,
                simulatedPrice,
                simulatedMarkup,
            };
        });
    }, [produtosBase, fichasTecnicas, insumos, selections, loading, parametros, markupKey]);
    
    const selectedSpecialInputs = useMemo(() => {
        return Object.keys(selections)
            .map(key => parseInt(key, 10))
            .filter(key => selections[key])
            .map(key => insumosEspeciais.find(i => i.id === key))
            .filter((i): i is NonNullable<typeof i> => !!i);
    }, [selections, insumosEspeciais]);

    // === Tabela de Preços por Malha ===
    // Permite escolher qual "insumo especial" vira coluna (padrão: o que contém "malha" no nome).
    const [meshSpecialId, setMeshSpecialId] = useState<number | null>(null);

    useEffect(() => {
        if (meshSpecialId !== null) return;
        if (!insumosEspeciais.length) return;
        const preferido = insumosEspeciais.find(i => /malha/i.test(i.nome));
        setMeshSpecialId((preferido ?? insumosEspeciais[0]).id);
    }, [insumosEspeciais, meshSpecialId]);

    const meshPricingTable = useMemo(() => {
        if (loading || !produtosBase.length || meshSpecialId === null) {
            return { malhas: [] as Insumo[], rows: [] as Array<{
                id: number;
                nome: string;
                baseCost: number;
                hasMesh: boolean;
                meshQuantity: number;
                prices: Record<number, number | null>;
            }> };
        }

        const insumosById = new Map<number, Insumo>(insumos.map(i => [i.id, i]));

        const malhas = insumosEspeciaisOpcoes
            .filter(opt => opt.insumo_especial_id === meshSpecialId)
            .map(opt => insumosById.get(opt.insumo_id))
            .filter((i): i is Insumo => !!i)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

        const fichasByProduct = fichasTecnicas.reduce<Record<number, FichaTecnica[]>>((acc, ft) => {
            if (!acc[ft.produto_base_id]) acc[ft.produto_base_id] = [];
            acc[ft.produto_base_id].push(ft);
            return acc;
        }, {});

        const markupValue = parametros?.[markupKey] || 1;

        const rows = produtosBase.map(produto => {
            const productFichas = fichasByProduct[produto.id] || [];

            const baseCost = productFichas
                .filter(ft => ft.insumo_id && ft.quantidade !== null)
                .reduce((sum, ft) => {
                    const insumo = insumosById.get(ft.insumo_id!);
                    return sum + ((insumo?.custo_unitario || 0) * (ft.quantidade || 0));
                }, 0);

            const meshFicha = productFichas.find(ft => ft.insumo_especial_id === meshSpecialId);
            const meshQuantity = meshFicha
                ? (meshFicha.quantidade ?? meshFicha.quantidade_adulto ?? meshFicha.quantidade_infantil ?? 0) || 0
                : 0;
            const hasMesh = !!meshFicha;

            const prices: Record<number, number | null> = {};
            malhas.forEach(malha => {
                if (!hasMesh) {
                    prices[malha.id] = null;
                    return;
                }
                const totalCost = baseCost + (malha.custo_unitario || 0) * meshQuantity;
                prices[malha.id] = produto.preco_venda_manual ?? (totalCost * markupValue);
            });

            return {
                id: produto.id,
                nome: produto.nome,
                baseCost,
                hasMesh,
                meshQuantity,
                prices,
            };
        });

        return { malhas, rows };
    }, [loading, produtosBase, insumos, insumosEspeciaisOpcoes, fichasTecnicas, parametros, markupKey, meshSpecialId]);

    if (loading) {
        return <div className="flex justify-center items-center p-10"><Spinner /></div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Análise de Custos</h1>
                <p className="text-slate-500 mt-1">Simule o custo final de cada produto com base na seleção de insumos especiais.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Filter size={18} className="mr-2 text-primary-600"/> Filtros de Simulação</CardTitle>
                    <p className="text-sm text-slate-500 pt-1">Selecione as opções para ver o custo e preço de venda simulados.</p>
                </CardHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {insumosEspeciais.map(specialInput => {
                        const options = insumosEspeciaisOpcoes
                            .filter(opt => opt.insumo_especial_id === specialInput.id)
                            .map(opt => insumos.find(i => i.id === opt.insumo_id))
                            .filter((i): i is NonNullable<typeof i> => !!i);
                        
                        return (
                            <div key={specialInput.id}>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">{specialInput.nome}</label>
                                <select
                                    value={selections[specialInput.id] || ''}
                                    onChange={e => setSelections(prev => ({ ...prev, [specialInput.id]: e.target.value }))}
                                    className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 transition"
                                >
                                    <option value="">Nenhum</option>
                                    {options.map(insumo => (
                                        <option key={insumo.id} value={insumo.id}>{insumo.nome}</option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Nível de Preço (Markup)</label>
                        <select
                            value={markupKey}
                            onChange={e => setMarkupKey(e.target.value as any)}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 transition"
                        >
                            <option value="markup_p1">Preço P1</option>
                            <option value="markup_p2">Preço P2</option>
                            <option value="markup_p3">Preço P3</option>
                        </select>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Resultado da Simulação</CardTitle>
                </CardHeader>
                {analysisData.length === 0 ? (
                    <EmptyState icon={<Calculator size={40}/>} message="Nenhum dado para analisar" description="Cadastre produtos e fichas técnicas para começar." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="sticky left-0 bg-slate-50 px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider z-10">Produto</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Custo Base</th>
                                    {selectedSpecialInputs.map(is => (
                                        <th key={is.id} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Adicional ({is.nome})</th>
                                    ))}
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"><Calculator size={14} className="inline mr-1"/> Custo Total</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"><DollarSign size={14} className="inline mr-1"/> Preço Venda</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"><Percent size={14} className="inline mr-1"/> Markup</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {analysisData.map(produto => (
                                    <tr key={produto.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="sticky left-0 bg-white hover:bg-slate-50 px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 z-10">{produto.nome}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{formatCurrency(produto.baseCost)}</td>
                                        {selectedSpecialInputs.map(is => {
                                             const breakdown = produto.specialCostsBreakdown[is.id];
                                             const cost = breakdown ? breakdown.cost : 0;
                                             return (
                                                 <td key={is.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                    {formatCurrency(cost)}
                                                 </td>
                                             );
                                        })}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-danger-700 font-semibold">{formatCurrency(produto.totalCost)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-success-700 font-semibold">{formatCurrency(produto.simulatedPrice)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-semibold">{produto.simulatedMarkup.toFixed(2)}x</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <TableIcon size={18} className="mr-2 text-primary-600"/> Tabela de Preços de Venda por Malha
                    </CardTitle>
                    <p className="text-sm text-slate-500 pt-1">
                        Preço de venda final de cada produto para cada opção de malha, usando o nível de preço selecionado acima.
                    </p>
                </CardHeader>

                {insumosEspeciais.length > 1 && (
                    <div className="mb-4 max-w-sm">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                            <Layers size={14} className="mr-1.5 text-slate-500"/> Categoria de insumo especial
                        </label>
                        <select
                            value={meshSpecialId ?? ''}
                            onChange={e => setMeshSpecialId(e.target.value ? parseInt(e.target.value, 10) : null)}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 transition"
                        >
                            {insumosEspeciais.map(is => (
                                <option key={is.id} value={is.id}>{is.nome}</option>
                            ))}
                        </select>
                    </div>
                )}

                {meshPricingTable.malhas.length === 0 ? (
                    <EmptyState
                        icon={<TableIcon size={40}/>}
                        message="Nenhuma malha cadastrada"
                        description="Cadastre opções para o insumo especial de malha em Cadastros para visualizar esta tabela."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="sticky left-0 bg-slate-50 px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider z-10">Produto</th>
                                    {meshPricingTable.malhas.map(malha => (
                                        <th key={malha.id} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                            {malha.nome}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {meshPricingTable.rows.map(produto => (
                                    <tr key={produto.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="sticky left-0 bg-white hover:bg-slate-50 px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 z-10">
                                            {produto.nome}
                                            {!produto.hasMesh && (
                                                <span className="ml-2 text-xs font-normal text-slate-400">(sem malha na ficha)</span>
                                            )}
                                        </td>
                                        {meshPricingTable.malhas.map(malha => {
                                            const preco = produto.prices[malha.id];
                                            return (
                                                <td key={malha.id} className="px-6 py-4 whitespace-nowrap text-sm text-success-700 font-semibold">
                                                    {preco === null ? <span className="text-slate-300">—</span> : formatCurrency(preco)}
                                                </td>
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