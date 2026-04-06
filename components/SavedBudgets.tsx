import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
// FIX: Import `Json` type to use in type casting.
import type { Orcamento, View, CurrentOrcamento, OrcamentoItem, OrcamentoItemAdicional, Json } from '../types';
import { Trash2, Edit, Copy, FileText, Printer, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { useNotification } from '../contexts/NotificationContext';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';
import BudgetDetailModal from './modals/BudgetDetailModal';
import { useData } from '../contexts/DataContext';


interface OrcamentoComVendedor extends Orcamento {
    vendedores: { nome: string } | null;
}

interface SavedBudgetsProps {
    setActiveView: (view: View) => void;
}

const SavedBudgets: React.FC<SavedBudgetsProps> = ({ setActiveView }) => {
    const { showNotification } = useNotification();
    const { setCurrentOrcamento, produtosBase } = useData();
    const [orcamentos, setOrcamentos] = useState<OrcamentoComVendedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrcamento, setSelectedOrcamento] = useState<OrcamentoComVendedor | null>(null);


    const fetchOrcamentos = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('orcamentos')
            .select('*, vendedores(nome)')
            .order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.ilike('nome_cliente', `%${searchTerm}%`);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error("Error fetching orcamentos:", error);
            showNotification('Erro ao carregar orçamentos.', 'danger');
        } else {
            setOrcamentos(data as OrcamentoComVendedor[]);
        }
        setLoading(false);
    }, [searchTerm, showNotification]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchOrcamentos();
        }, 300);
        return () => clearTimeout(debounce);
    }, [fetchOrcamentos]);

    const handleDelete = async (id: number) => {
        if (window.confirm("Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.")) {
            try {
                const { error: itemError } = await supabase.from('orcamento_itens').delete().eq('orcamento_id', id);
                if (itemError) throw itemError;

                const { error: orcamentoError } = await supabase.from('orcamentos').delete().eq('id', id);
                if (orcamentoError) throw orcamentoError;

                showNotification('Orçamento excluído com sucesso.', 'success');
                fetchOrcamentos();
            } catch (error: any) {
                showNotification(`Falha ao excluir: ${error.message}`, 'danger');
            }
        }
    };
    
    const handleDuplicate = async (orcamento: OrcamentoComVendedor) => {
        try {
            const { data: originalItems, error: itemsError } = await supabase
                .from('orcamento_itens')
                .select('*')
                .eq('orcamento_id', orcamento.id);

            if (itemsError) throw itemsError;

            const newBudgetData = {
                nome_cliente: `${orcamento.nome_cliente} (Cópia)`,
                vendedor_id: orcamento.vendedor_id,
                total_receita: orcamento.total_receita,
                total_custo_producao: orcamento.total_custo_producao,
                total_custos_variaveis: orcamento.total_custos_variaveis,
                total_lucro: orcamento.total_lucro,
            };

            const { data: newOrcamento, error: newOrcamentoError } = await supabase
                .from('orcamentos')
                .insert(newBudgetData)
                .select()
                .single();
            
            if (newOrcamentoError) throw newOrcamentoError;

            if (originalItems && originalItems.length > 0) {
                const newItems = originalItems.map(item => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { id, orcamento_id, ...rest } = item;
                    return { ...rest, orcamento_id: newOrcamento.id };
                });

                const { error: newItemsError } = await supabase.from('orcamento_itens').insert(newItems);
                if (newItemsError) throw newItemsError;
            }
            
            showNotification('Orçamento duplicado com sucesso!', 'success');
            await fetchOrcamentos();

        } catch (error: any) {
             showNotification(`Falha ao duplicar: ${error.message}`, 'danger');
        }
    };

    const handleLoadBudget = async (orcamentoId: number) => {
        try {
            const { data: orcamentoData, error: orcamentoError } = await supabase
                .from('orcamentos')
                .select('*')
                .eq('id', orcamentoId)
                .single();
            if (orcamentoError) throw orcamentoError;

            const { data: itemsData, error: itemsError } = await supabase
                .from('orcamento_itens')
                .select('*')
                .eq('orcamento_id', orcamentoId);
            if (itemsError) throw itemsError;

            if (!itemsData) {
                throw new Error("Não foram encontrados itens para este orçamento.");
            }

            // Busca produtos do banco para IDs que não estão na lista local (ex: criados pelo webhook)
            const missingIds = itemsData
                .map(i => i.produto_base_id)
                .filter(id => !produtosBase.find(p => p.id === id));

            let extraProdutos: typeof produtosBase = [];
            if (missingIds.length > 0) {
                const { data: fetchedProdutos } = await supabase
                    .from('produtos_base')
                    .select('*')
                    .in('id', missingIds);
                extraProdutos = fetchedProdutos || [];
            }

            const allProdutos = [...produtosBase, ...extraProdutos];

            const loadedItens: OrcamentoItem[] = itemsData.map(itemDB => {
                const produto = allProdutos.find(p => p.id === itemDB.produto_base_id);
                if (!produto) {
                    showNotification(`Produto com ID ${itemDB.produto_base_id} não encontrado. O item será ignorado.`, 'warning');
                    return null;
                }
                
                let adicionais: OrcamentoItemAdicional[] = [];
                let specialSelections: Record<number, number> = {};
                let tamanho: 'infantil' | 'adulto' | 'geral' | null = null;

                if (itemDB.adicionais && typeof itemDB.adicionais === 'object' && !Array.isArray(itemDB.adicionais)) {
                    const payload = itemDB.adicionais as { 
                        adicionais?: OrcamentoItemAdicional[], 
                        specialSelections?: Record<number, number>,
                        tamanho?: 'infantil' | 'adulto' | 'geral' | null 
                    };
                    if (payload.adicionais && Array.isArray(payload.adicionais)) {
                        adicionais = payload.adicionais;
                    }
                    if (payload.specialSelections && typeof payload.specialSelections === 'object') {
                        specialSelections = payload.specialSelections;
                    }
                    if (payload.tamanho) {
                        tamanho = payload.tamanho;
                    }
                }

                const custoUnitario = itemDB.custo_unitario_calculado;
                const precoUnitario = itemDB.preco_unitario_praticado;
                const markup = custoUnitario > 0 ? precoUnitario / custoUnitario : 0;

                return {
                    id: `loaded-${itemDB.id}`,
                    produto,
                    // FIX: Cast `adicionais` to `Json` to match the `OrcamentoItem` type definition.
                    adicionais: adicionais as unknown as Json,
                    specialSelections,
                    tamanho,
                    quantidade: itemDB.quantidade,
                    custoUnitario,
                    precoUnitario,
                    precoTabelaUnitario: precoUnitario, // Best assumption for loaded budget
                    markup,
                };
            }).filter((item): item is OrcamentoItem => item !== null);

            const loadedOrcamento: CurrentOrcamento = {
                id: orcamentoData.id,
                nomeCliente: orcamentoData.nome_cliente,
                vendedorId: orcamentoData.vendedor_id,
                itens: loadedItens,
            };

            setCurrentOrcamento(loadedOrcamento);
            setActiveView('builder');
            showNotification(`Orçamento #${orcamentoId} carregado para edição.`, 'info');

        } catch (error: any) {
            console.error("Error loading budget:", error);
            showNotification(`Falha ao carregar orçamento: ${error.message}`, 'danger');
        }
    };

    const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-3xl font-bold text-slate-900">Orçamentos Salvos</h1>
                <p className="text-slate-500 mt-1">Visualize, duplique ou exclua orçamentos gerados anteriormente.</p>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <CardTitle>Histórico de Orçamentos</CardTitle>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar por cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2 pl-10 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                </CardHeader>

                {loading ? <div className="flex justify-center items-center p-10"><Spinner /></div> : (
                    <div>
                        {orcamentos.length === 0 ? (
                            <div className="p-4">
                                <EmptyState icon={<FileText size={40}/>} message="Nenhum orçamento encontrado" description={searchTerm ? "Tente um termo de busca diferente." : "Crie seu primeiro orçamento na aba 'Criar Orçamento'."}/>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="overflow-x-auto hidden md:block">
                                    <table className="min-w-full">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendedor</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Receita</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Lucro</th>
                                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100">
                                            {orcamentos.map(o => (
                                                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{o.nome_cliente}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{o.vendedores?.nome}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-semibold">{formatCurrency(o.total_receita)}</td>
                                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${o.total_lucro >= 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatCurrency(o.total_lucro)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-4">
                                                        <button onClick={() => setSelectedOrcamento(o)} title="Visualizar e Imprimir" className="text-slate-500 hover:text-primary-600 transition-colors"><Printer size={18} /></button>
                                                        <button onClick={() => handleDuplicate(o)} title="Duplicar Orçamento" className="text-slate-500 hover:text-green-600 transition-colors"><Copy size={18} /></button>
                                                        <button onClick={() => handleLoadBudget(o.id)} title="Carregar para Editar" className="text-slate-500 hover:text-blue-600 transition-colors"><Edit size={18} /></button>
                                                        <button onClick={() => handleDelete(o.id)} title="Excluir" className="text-slate-500 hover:text-danger-600 transition-colors"><Trash2 size={18} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="md:hidden space-y-4 p-4">
                                    {orcamentos.map(o => (
                                        <div key={o.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-slate-800">{o.nome_cliente}</p>
                                                    <p className="text-sm text-slate-500">{o.vendedores?.nome}</p>
                                                </div>
                                                <p className="text-sm text-slate-500">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase">Receita</p>
                                                    <p className="font-semibold text-slate-800">{formatCurrency(o.total_receita)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase">Lucro</p>
                                                    <p className={`font-semibold ${o.total_lucro >= 0 ? 'text-success-600' : 'text-danger-600'}`}>{formatCurrency(o.total_lucro)}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t flex justify-around items-center">
                                                <button onClick={() => setSelectedOrcamento(o)} title="Visualizar e Imprimir" className="flex flex-col items-center text-slate-600 hover:text-primary-600 transition-colors"><Printer size={20} /><span className="text-xs mt-1">Ver</span></button>
                                                <button onClick={() => handleDuplicate(o)} title="Duplicar" className="flex flex-col items-center text-slate-600 hover:text-green-600 transition-colors"><Copy size={20} /><span className="text-xs mt-1">Duplicar</span></button>
                                                <button onClick={() => handleLoadBudget(o.id)} title="Editar" className="flex flex-col items-center text-slate-600 hover:text-blue-600 transition-colors"><Edit size={20} /><span className="text-xs mt-1">Editar</span></button>
                                                <button onClick={() => handleDelete(o.id)} title="Excluir" className="flex flex-col items-center text-slate-600 hover:text-danger-600 transition-colors"><Trash2 size={20} /><span className="text-xs mt-1">Excluir</span></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Card>
            {selectedOrcamento && (
                <BudgetDetailModal 
                    orcamento={selectedOrcamento}
                    onClose={() => setSelectedOrcamento(null)}
                />
            )}
        </div>
    );
};

export default SavedBudgets;