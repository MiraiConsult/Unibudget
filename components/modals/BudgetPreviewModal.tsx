import React, { useState } from 'react';
import type { CurrentOrcamento, Vendedor, OrcamentoItemAdicional } from '../../types';
import { X, Printer, Loader2 } from 'lucide-react';
import { exportToPDF } from '../../utils/pdfExporter';

interface BudgetPreviewModalProps {
    orcamento: CurrentOrcamento;
    vendedores: Vendedor[];
    onClose: () => void;
}

const BudgetPreviewModal: React.FC<BudgetPreviewModalProps> = ({ orcamento, vendedores, onClose }) => {
    const [isExporting, setIsExporting] = useState(false);
    const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const vendedorNome = vendedores.find(v => v.id === orcamento.vendedorId)?.nome || 'N/A';
    const totalOrcamento = orcamento.itens.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0);

    const handleExport = async () => {
        setIsExporting(true);
        const fileName = `proposta_${orcamento.id || 'novo'}_${orcamento.nomeCliente.replace(/\s+/g, '-')}.pdf`;
        await exportToPDF('budget-preview-to-export', fileName);
        setIsExporting(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b bg-slate-50 rounded-t-lg">
                    <h2 className="text-xl font-bold text-slate-800">Pré-visualização da Proposta</h2>
                    <div className="flex items-center space-x-4">
                        <button onClick={handleExport} disabled={isExporting} className="flex items-center text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition-colors disabled:bg-slate-400">
                           {isExporting ? <Loader2 className="animate-spin mr-2" size={16}/> : <Printer size={16} className="mr-2" />} 
                           {isExporting ? 'Exportando...' : 'Exportar PDF'}
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                    </div>
                </div>
                <div className="overflow-y-auto p-2 sm:p-6 bg-slate-100">
                    <div id="budget-preview-to-export" className="bg-white p-8 shadow-lg max-w-3xl mx-auto A4-aspect-ratio" style={{ width: '210mm', minHeight: '297mm' }}>
                        <header className="flex justify-between items-start border-b border-slate-200 pb-4 mb-8">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900">Uni<span className="text-primary-500">Budget</span></h1>
                                <p className="text-slate-500 text-sm">Sua Empresa de Uniformes</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-bold text-slate-800">Proposta Comercial</h2>
                                <p className="text-slate-500 text-sm">Data: {new Date().toLocaleDateString('pt-BR')}</p>
                            </div>
                        </header>
                        <section className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Proposta Para:</p>
                                <p className="font-semibold text-slate-900 text-lg">{orcamento.nomeCliente}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Vendedor Responsável:</p>
                                <p className="font-semibold text-slate-900 text-lg">{vendedorNome}</p>
                            </div>
                        </section>
                        <section>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-300">
                                        <th className="p-2 text-left font-semibold text-slate-600 uppercase">Produto/Serviço</th>
                                        <th className="p-2 text-center font-semibold text-slate-600 uppercase">Qtd.</th>
                                        <th className="p-2 text-right font-semibold text-slate-600 uppercase">Preço Unit.</th>
                                        <th className="p-2 text-right font-semibold text-slate-600 uppercase">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {orcamento.itens.map(item => (
                                        <tr key={item.id}>
                                            <td className="p-2 align-top">
                                                <p className="font-medium text-slate-800">{item.produto.nome}</p>
                                                {item.tamanho && (
                                                    <p className="text-xs text-slate-500 capitalize pt-0.5">
                                                        (Tamanho: {item.tamanho === 'geral' ? 'Padrão' : item.tamanho})
                                                    </p>
                                                )}
                                                {(() => {
                                                    const adicionaisRaw = item.adicionais;
                                                    let adicionaisList: OrcamentoItemAdicional[] = [];

                                                    if (Array.isArray(adicionaisRaw)) {
                                                        // FIX: Cast `adicionaisRaw` to the expected type to resolve type mismatch.
                                                        adicionaisList = adicionaisRaw as unknown as OrcamentoItemAdicional[];
                                                    } else if (adicionaisRaw && typeof adicionaisRaw === 'object') {
                                                        const payload = adicionaisRaw as { adicionais?: OrcamentoItemAdicional[] };
                                                        if (payload.adicionais && Array.isArray(payload.adicionais)) {
                                                            adicionaisList = payload.adicionais;
                                                        }
                                                    }
                                                
                                                    if (adicionaisList.length > 0) {
                                                        return (
                                                            <ul className="pl-4 mt-1 text-xs text-slate-500 list-disc">
                                                                {adicionaisList.map((ad: OrcamentoItemAdicional) => (
                                                                    <li key={ad.adicionalId}>{ad.nome_opcao} (x{ad.quantidade})</li>
                                                                ))}
                                                            </ul>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </td>
                                            <td className="p-2 text-center align-top">{item.quantidade}</td>
                                            <td className="p-2 text-right align-top">{formatCurrency(item.precoUnitario)}</td>
                                            <td className="p-2 text-right align-top font-semibold">{formatCurrency(item.precoUnitario * item.quantidade)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                        <section className="flex justify-end mt-8">
                            <div className="w-full max-w-sm">
                                <div className="flex justify-between items-center bg-slate-100 p-4 rounded-lg">
                                    <span className="font-semibold text-slate-800 text-lg">VALOR TOTAL</span>
                                    <span className="font-bold text-primary-600 text-xl">{formatCurrency(totalOrcamento)}</span>
                                </div>
                            </div>
                        </section>
                         <footer className="text-center text-xs text-slate-400 mt-12 pt-4 border-t border-slate-200">
                            <p>UniBudget | Rua Exemplo, 123, Cidade/UF | (00) 12345-6789 | email@empresa.com</p>
                            <p>Proposta válida por 15 dias.</p>
                        </footer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BudgetPreviewModal;