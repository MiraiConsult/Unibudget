import React, { useEffect, useState, ReactElement, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { DollarSign, FileText, ShoppingBag, TrendingUp } from 'lucide-react';
import type { Orcamento } from '../types';
import Spinner from './ui/Spinner';
import BarChart from './charts/BarChart';
import DateRangeFilter from './ui/DateRangeFilter';

interface MetricCardProps {
    title: string;
    value: string;
    icon: React.ReactElement<React.SVGAttributes<SVGSVGElement>>;
    iconBgColor: string;
    iconColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, iconBgColor, iconColor }) => (
    <Card className="p-5">
        <div className="flex items-center">
            <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg mr-4 ${iconBgColor}`}>
                {/* FIX: Cast props to `any` to resolve issue where `size` is not a recognized SVG attribute but is a valid prop for the lucide-react icon component. */}
                {React.cloneElement(icon, { className: iconColor, size: 24 } as any)}
            </div>
            <div className="flex-1">
                <p className="text-sm text-slate-500">{title}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    </Card>
);

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState({
        totalReceita: 0,
        totalLucro: 0,
        totalOrcamentos: 0,
        ticketMedio: 0,
    });
    const [recentOrcamentos, setRecentOrcamentos] = useState<any[]>([]);
    const [topProdutos, setTopProdutos] = useState<any[]>([]);
    const [topVendedores, setTopVendedores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(todayStr);

    const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    interface OrcamentoWithVendedor extends Orcamento {
        vendedores: { nome: string } | null;
    }
    interface OrcamentoItemWithProduto {
        quantidade: number;
        preco_unitario_praticado: number;
        produtos_base: { nome: string } | null;
    }

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let orcamentosQuery = supabase
                .from('orcamentos')
                .select('id, created_at, nome_cliente, total_receita, total_lucro, vendedores(nome)');
            
            if (startDate) {
                orcamentosQuery = orcamentosQuery.gte('created_at', new Date(startDate).toISOString());
            }
            if (endDate) {
                 const inclusiveEndDate = new Date(endDate);
                 inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
                 orcamentosQuery = orcamentosQuery.lte('created_at', inclusiveEndDate.toISOString());
            }

            const { data: orcamentosData, error: orcamentosError } = await orcamentosQuery;
            if (orcamentosError) throw orcamentosError;
            
            const orcamentos = (orcamentosData as OrcamentoWithVendedor[]) || [];

            const totalReceita = orcamentos.reduce((sum, o) => sum + o.total_receita, 0);
            const totalLucro = orcamentos.reduce((sum, o) => sum + o.total_lucro, 0);
            const totalOrcamentos = orcamentos.length;
            const ticketMedio = totalOrcamentos > 0 ? totalReceita / totalOrcamentos : 0;
            setStats({ totalReceita, totalLucro, totalOrcamentos, ticketMedio });

            setRecentOrcamentos(orcamentos.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5));

            const vendorSales = orcamentos.reduce((acc, o) => {
                const vendorName = o.vendedores?.nome || 'N/A';
                acc[vendorName] = (acc[vendorName] || 0) + o.total_receita;
                return acc;
            }, {} as Record<string, number>);
            setTopVendedores(Object.entries(vendorSales).sort((a,b) => b[1] - a[1]).slice(0, 5));

            const orcamentoIds = orcamentos.map(o => o.id);
            if (orcamentoIds.length > 0) {
                const { data: orcamentoItensData, error: itensError } = await supabase
                    .from('orcamento_itens')
                    .select('quantidade, preco_unitario_praticado, produtos_base(nome)')
                    .in('orcamento_id', orcamentoIds);
                
                if (itensError) throw itensError;

                const productSales = ((orcamentoItensData as OrcamentoItemWithProduto[]) || []).reduce((acc, item) => {
                    const productName = item.produtos_base?.nome || 'Produto Deletado';
                    const value = item.preco_unitario_praticado * item.quantidade;
                    acc[productName] = (acc[productName] || 0) + value;
                    return acc;
                }, {} as Record<string, number>);
                setTopProdutos(Object.entries(productSales).sort((a,b) => b[1] - a[1]).slice(0, 5));
            } else {
                 setTopProdutos([]);
            }
            
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const chartData = (data: any[], label: string, bgColor: string, borderColor: string) => {
        const labels = data.map(item => item[0]);
        const values = data.map(item => item[1]);
        return {
            labels,
            datasets: [
                {
                    label,
                    data: values,
                    backgroundColor: bgColor,
                    borderColor: borderColor,
                    borderWidth: 1,
                },
            ],
        };
    };

    if (loading) {
        return <div className="flex justify-center items-center p-10"><Spinner /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Visão Geral</h1>
                    <p className="text-slate-500 mt-1">Acompanhe os indicadores chave de performance da sua empresa.</p>
                </div>
                 <DateRangeFilter 
                    startDate={startDate} 
                    endDate={endDate} 
                    onStartDateChange={setStartDate} 
                    onEndDateChange={setEndDate} 
                />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Receita Total" value={formatCurrency(stats.totalReceita)} icon={<DollarSign />} iconBgColor="bg-success-100" iconColor="text-success-600" />
                <MetricCard title="Lucro Total" value={formatCurrency(stats.totalLucro)} icon={<TrendingUp />} iconBgColor="bg-primary-100" iconColor="text-primary-600" />
                <MetricCard title="Orçamentos" value={stats.totalOrcamentos.toString()} icon={<FileText />} iconBgColor="bg-warning-100" iconColor="text-warning-600" />
                <MetricCard title="Ticket Médio" value={formatCurrency(stats.ticketMedio)} icon={<ShoppingBag />} iconBgColor="bg-slate-200" iconColor="text-slate-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Top 5 Produtos por Receita</CardTitle>
                    </CardHeader>
                     {topProdutos.length > 0 ? (
                        <BarChart
                            data={chartData(topProdutos, 'Receita', 'rgba(249, 115, 22, 0.6)', 'rgba(234, 88, 12, 1)')}
                            title="Top 5 Produtos por Receita"
                        />
                     ) : <p className="text-center text-slate-500 py-10">Nenhum dado de produto no período.</p>}
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Top 5 Vendedores por Receita</CardTitle>
                    </CardHeader>
                    {topVendedores.length > 0 ? (
                        <BarChart
                            data={chartData(topVendedores, 'Receita', 'rgba(34, 197, 94, 0.6)', 'rgba(22, 163, 74, 1)')}
                            title="Top 5 Vendedores por Receita"
                        />
                    ) : <p className="text-center text-slate-500 py-10">Nenhum dado de vendedor no período.</p>}
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Orçamentos Recentes</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-50 hidden md:table-header-group">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendedor</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                             {recentOrcamentos.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-10 text-slate-500">Nenhum orçamento recente.</td>
                                </tr>
                            )}
                            {recentOrcamentos.map(o => (
                                <tr key={o.id} className="block md:table-row border-b md:border-none mb-4 md:mb-0 hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 block md:table-cell"><span className="font-semibold md:hidden">Cliente: </span>{o.nome_cliente}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 block md:table-cell"><span className="font-semibold md:hidden">Vendedor: </span>{o.vendedores?.nome}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 block md:table-cell"><span className="font-semibold md:hidden">Data: </span>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800 block md:table-cell md:text-right"><span className="font-semibold md:hidden">Valor: </span>{formatCurrency(o.total_receita)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default Dashboard;