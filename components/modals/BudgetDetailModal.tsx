import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import type { Orcamento, OrcamentoItemDB, OrcamentoItemAdicional } from '../../types';
import Spinner from '../ui/Spinner';
import { X, Printer } from 'lucide-react';
import { exportToPDF } from '../../utils/pdfExporter';


interface OrcamentoComVendedor extends Orcamento {
    vendedores: { nome: string } | null;
}

interface OrcamentoItemComProduto extends OrcamentoItemDB {
    produtos_base: { nome: string } | null;
}

interface BudgetDetailModalProps {
    orcamento: OrcamentoComVendedor;
    onClose: () => void;
}

const BudgetDetailModal: React.FC<BudgetDetailModalProps> = ({ orcamento, onClose }) => {
    const [itens, setItens] = useState<OrcamentoItemComProduto[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const fetchItens = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('orcamento_itens')
                .select('*, produtos_base(nome)')
                .eq('orcamento_id', orcamento.id);
            
            if (error) {
                console.error("Error fetching budget items:", error);
            } else {
                setItens(data as any);
            }
            setLoading(false);
        };
        fetchItens();
    }, [orcamento.id]);

    const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const handleExport = async () => {
        setIsExporting(true);
        const fileName = `orcamento_${orcamento.id}_${orcamento.nome_cliente.replace(/\s+/g, '-')}.pdf`;
        await exportToPDF('budget-to-export', fileName);
        setIsExporting(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-slate-800">Detalhes do Orçamento #{orcamento.id}</h2>
                    <div className="flex items-center space-x-4">
                        <button onClick={handleExport} disabled={isExporting} className="flex items-center text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition-colors disabled:bg-slate-400">
                           {isExporting ? <Spinner/> : <><Printer size={16} className="mr-2" /> Exportar PDF</>}
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                <div className="overflow-y-auto p-6" id="budget-to-export">
                    {loading ? <Spinner /> : (
                        <div className="space-y-6">
                            <div className="p-4 border rounded-lg grid grid-cols-3 gap-4">
                                <div><p className="text-sm text-slate-500">Cliente</p><p className="font-semibold text-slate-800">{orcamento.nome_cliente}</p></div>
                                <div><p className="text-sm text-slate-500">Vendedor</p><p className="font-semibold text-slate-800">{orcamento.vendedores?.nome}</p></div>
                                <div><p className="text-sm text-slate-500">Data</p><p className="font-semibold text-slate-800">{new Date(orcamento.created_at).toLocaleDateString('pt-BR')}</p></div>
                            </div>
                            
                            <div>
                                <h3 className="font-semibold text-slate-700 mb-2">Itens do Orçamento</h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="p-3 text-left font-semibold text-slate-600">Produto</th>
                                                <th className="p-3 text-center font-semibold text-slate-600">Qtd</th>
                                                <th className="p-3 text-right font-semibold text-slate-600">Preço Unit.</th>
                                                <th className="p-3 text-right font-semibold text-slate-600">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {itens.map(item => (
                                                <tr key={item.id}>
                                                    <td className="p-3 align-top">
                                                        <p className="font-medium text-slate-800">{item.produtos_base?.nome}</p>
                                                        {/* FIX: Correctly parse the 'adicionais' JSON object to access the inner array of 'adicionais'. */}
                                                        {(() => {
                                                            if (item.adicionais && typeof item.adicionais === 'object' && !Array.isArray(item.adicionais)) {
                                                                const payload = item.adicionais as { adicionais?: OrcamentoItemAdicional[] };
                                                                if (payload.adicionais && Array.isArray(payload.adicionais) && payload.adicionais.length > 0) {
                                                                    return (
                                                                        <ul className="pl-4 mt-1 text-xs text-slate-500 list-disc">
                                                                            {payload.adicionais.map(ad => (
                                                                                <li key={ad.adicionalId}>{ad.nome_opcao} (x{ad.quantidade}) - {formatCurrency(ad.preco_venda)}</li>
                                                                            ))}
                                                                        </ul>
                                                                    );
                                                                }
                                                            }
                                                            return null;
                                                        })()}
                                                    </td>
                                                    <td className="p-3 text-center align-top">{item.quantidade}</td>
                                                    <td className="p-3 text-right align-top">{formatCurrency(item.preco_unitario_praticado)}</td>
                                                    <td className="p-3 text-right align-top font-semibold">{formatCurrency(item.preco_unitario_praticado * item.quantidade)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <div className="flex justify-end">
                                <div className="w-full max-w-sm space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-semibold text-slate-800">{formatCurrency(orcamento.total_receita)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-600">Custo Produção</span><span className="font-semibold text-slate-800">{formatCurrency(orcamento.total_custo_producao)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-600">Custos Variáveis</span><span className="font-semibold text-slate-800">{formatCurrency(orcamento.total_custos_variaveis)}</span></div>
                                    <div className="flex justify-between pt-2 border-t font-bold text-base"><span className="text-slate-800">Lucro Estimado</span><span className="text-success-600">{formatCurrency(orcamento.total_lucro)}</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BudgetDetailModal;