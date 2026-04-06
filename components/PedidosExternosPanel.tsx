import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useNotification } from '../contexts/NotificationContext';
import { supabase } from '../services/supabaseClient';
import { Card } from './ui/Card';
import { Package, CheckCircle, AlertCircle, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import type { PedidoExterno, View } from '../types';
import Spinner from './ui/Spinner';

interface PedidosExternosPanelProps {
    setActiveView: (view: View) => void;
}

const PedidosExternosPanel: React.FC<PedidosExternosPanelProps> = ({ setActiveView }) => {
    const { fetchData } = useData(); // ← fetchData para recarregar produtos/vendedores no sistema
    const { showNotification } = useNotification();
    const [pedidos, setPedidos] = useState<PedidoExterno[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [filter, setFilter] = useState<'todos' | 'pendentes' | 'processados' | 'erro'>('todos');

    const fetchPedidos = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pedidos_externos')
                .select('*')
                .order('data_pedido', { ascending: false });

            if (error) throw error;
            setPedidos(data || []);
        } catch (error: any) {
            console.error('Erro ao buscar pedidos externos:', error);
            showNotification('Erro ao carregar pedidos externos', 'danger');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPedidos();
    }, []);

    const handleProcessarPedido = async (pedidoId: number) => {
        setProcessingId(pedidoId);
        try {
            // ← CORRIGIDO: nome correto da função no banco
            const { data, error } = await supabase.rpc('processar_pedido_externo', {
                p_pedido_externo_id: pedidoId
            });

            if (error) throw error;

            if (data && data.sucesso) {
                let msg = `Orçamento #${data.orcamento_id} criado com sucesso!`;
                if (data.vendedor_id) {
                    msg += ` Vendedor resolvido (ID ${data.vendedor_id}).`;
                }
                showNotification(msg, 'success');

                if (data.produtos_criados && data.produtos_criados.length > 0) {
                    showNotification(
                        `⚠️ ${data.produtos_criados.length} produto(s) criado(s) sem ficha técnica. Configure-os para calcular o custo.`,
                        'warning'
                    );
                }

                // ← CRÍTICO: recarrega produtos, vendedores e todos os dados do DataContext
                // Sem isso, o novo produto/vendedor fica no Supabase mas não aparece no sistema
                await fetchData();

                // Atualiza a lista de pedidos externos
                await fetchPedidos();

            } else {
                showNotification(`Erro ao processar: ${data?.erro || 'Desconhecido'}`, 'danger');
            }
        } catch (error: any) {
            console.error('Erro ao processar pedido:', error);
            showNotification(`Erro ao processar pedido: ${error.message}`, 'danger');
        } finally {
            setProcessingId(null);
        }
    };

    const filteredPedidos = pedidos.filter(p => {
        if (filter === 'todos') return true;
        if (filter === 'pendentes') return !p.processado;
        if (filter === 'processados') return p.processado && p.orcamento_id;
        if (filter === 'erro') return p.processado && !p.orcamento_id;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Pedidos Externos</h1>
                    <p className="text-slate-500 mt-1">Gerencie os pedidos recebidos via integração e crie orçamentos automaticamente.</p>
                </div>
                <button
                    onClick={fetchPedidos}
                    className="flex items-center justify-center px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-slate-50 transition-all self-start md:self-center"
                >
                    <RefreshCw size={18} className="mr-2"/>
                    Atualizar
                </button>
            </div>

            <Card>
                <div className="flex border-b border-slate-200 overflow-x-auto p-4 gap-2">
                    {(['todos', 'pendentes', 'processados'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${
                                filter === f
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center items-center p-12">
                            <Spinner />
                        </div>
                    ) : filteredPedidos.length === 0 ? (
                        <div className="text-center p-12 text-slate-500">
                            Nenhum pedido encontrado com este filtro.
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="py-3 px-6 font-semibold text-slate-700 text-sm">Código</th>
                                    <th className="py-3 px-6 font-semibold text-slate-700 text-sm">Data</th>
                                    <th className="py-3 px-6 font-semibold text-slate-700 text-sm">Cliente</th>
                                    <th className="py-3 px-6 font-semibold text-slate-700 text-sm">Vendedor</th>
                                    <th className="py-3 px-6 font-semibold text-slate-700 text-sm">Valor</th>
                                    <th className="py-3 px-6 font-semibold text-slate-700 text-sm">Status</th>
                                    <th className="py-3 px-6 font-semibold text-slate-700 text-sm text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPedidos.map(pedido => (
                                    <tr key={pedido.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-6 font-medium text-slate-800">#{pedido.codigo_pedido}</td>
                                        <td className="py-3 px-6 text-slate-600">
                                            {new Date(pedido.data_pedido + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="py-3 px-6 text-slate-600">{pedido.customer_name}</td>
                                        <td className="py-3 px-6 text-slate-600">{pedido.seller_name}</td>
                                        <td className="py-3 px-6 font-medium text-slate-800">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.valor_total)}
                                        </td>
                                        <td className="py-3 px-6">
                                            {!pedido.processado ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    <Clock size={12} className="mr-1" /> Pendente
                                                </span>
                                            ) : pedido.orcamento_id ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    <CheckCircle size={12} className="mr-1" /> Processado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    <AlertCircle size={12} className="mr-1" /> Erro
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-6 text-right">
                                            {!pedido.processado ? (
                                                <button
                                                    onClick={() => handleProcessarPedido(pedido.id)}
                                                    disabled={processingId === pedido.id}
                                                    className="inline-flex items-center px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded hover:bg-orange-700 transition-colors disabled:opacity-50"
                                                >
                                                    {processingId === pedido.id ? <Spinner /> : 'Criar Orçamento'}
                                                </button>
                                            ) : pedido.orcamento_id ? (
                                                <button
                                                    onClick={() => setActiveView('saved')}
                                                    className="inline-flex items-center px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded hover:bg-slate-200 transition-colors"
                                                >
                                                    <ExternalLink size={14} className="mr-1" /> Ver Orçamento
                                                </button>
                                            ) : (
                                                <span className="text-slate-400 text-sm">Falha</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default PedidosExternosPanel;