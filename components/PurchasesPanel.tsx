import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Card } from './ui/Card';
import { ShoppingCart, Plus, Trash2, Search } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';

const PurchasesPanel: React.FC = () => {
    const { insumos, compras, addCompra, deleteCompra } = useData();
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    
    const [newCompra, setNewCompra] = useState({
        data_compra: new Date().toISOString().split('T')[0],
        fornecedor: '',
        insumo_id: '',
        quantidade: '',
        preco_unitario: '',
    });

    const handleAddCompra = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newCompra.data_compra || !newCompra.fornecedor || !newCompra.insumo_id || !newCompra.quantidade || !newCompra.preco_unitario) {
            showNotification('Preencha todos os campos', 'warning');
            return;
        }

        const quantidade = parseFloat(newCompra.quantidade);
        const preco_unitario = parseFloat(newCompra.preco_unitario);
        
        if (isNaN(quantidade) || quantidade <= 0 || isNaN(preco_unitario) || preco_unitario <= 0) {
            showNotification('Valores inválidos', 'danger');
            return;
        }

        const valor_total = quantidade * preco_unitario;

        const success = await addCompra({
            data_compra: newCompra.data_compra,
            fornecedor: newCompra.fornecedor,
            insumo_id: parseInt(newCompra.insumo_id),
            quantidade,
            preco_unitario,
            valor_total
        });

        if (success) {
            showNotification('Compra registrada com sucesso', 'success');
            setNewCompra({
                data_compra: new Date().toISOString().split('T')[0],
                fornecedor: '',
                insumo_id: '',
                quantidade: '',
                preco_unitario: '',
            });
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Tem certeza que deseja excluir esta compra? Isso afetará o estoque.')) {
            const success = await deleteCompra(id);
            if (success) {
                showNotification('Compra excluída com sucesso', 'success');
            }
        }
    };

    const filteredCompras = compras.filter(compra => {
        const insumo = insumos.find(i => i.id === compra.insumo_id);
        const searchLower = searchTerm.toLowerCase();
        return (
            compra.fornecedor.toLowerCase().includes(searchLower) ||
            (insumo && insumo.nome.toLowerCase().includes(searchLower))
        );
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Registro de Compras</h1>
                <p className="text-slate-500 mt-1">Cadastre novas compras para alimentar o estoque de insumos.</p>
            </div>

            <Card className="p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                    <Plus size={20} className="mr-2 text-primary-600" />
                    Nova Compra
                </h2>
                <form onSubmit={handleAddCompra} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                        <input
                            type="date"
                            value={newCompra.data_compra}
                            onChange={(e) => setNewCompra({...newCompra, data_compra: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"
                            required
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
                        <input
                            type="text"
                            placeholder="Nome do fornecedor"
                            value={newCompra.fornecedor}
                            onChange={(e) => setNewCompra({...newCompra, fornecedor: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"
                            required
                        />
                    </div>
                    <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Insumo</label>
                        <select
                            value={newCompra.insumo_id}
                            onChange={(e) => setNewCompra({...newCompra, insumo_id: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"
                            required
                        >
                            <option value="">Selecione um insumo...</option>
                            {insumos.map(insumo => (
                                <option key={insumo.id} value={insumo.id}>
                                    {insumo.nome} ({insumo.unidade_medida})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                        <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={newCompra.quantidade}
                            onChange={(e) => setNewCompra({...newCompra, quantidade: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"
                            required
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Preço Unit. (R$)</label>
                        <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={newCompra.preco_unitario}
                            onChange={(e) => setNewCompra({...newCompra, preco_unitario: e.target.value})}
                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"
                            required
                        />
                    </div>
                    <div className="lg:col-span-6 flex justify-end mt-2">
                        <button
                            type="submit"
                            className="flex items-center px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg shadow hover:bg-primary-700 transition-colors"
                        >
                            <ShoppingCart size={18} className="mr-2" />
                            Registrar Compra
                        </button>
                    </div>
                </form>
            </Card>

            <Card>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                    <h2 className="text-lg font-semibold text-slate-800">Histórico de Compras</h2>
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar fornecedor ou insumo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                                <th className="py-3 px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                                <th className="py-3 px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Insumo</th>
                                <th className="py-3 px-6 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantidade</th>
                                <th className="py-3 px-6 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Preço Unit.</th>
                                <th className="py-3 px-6 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                                <th className="py-3 px-6 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCompras.map(compra => {
                                const insumo = insumos.find(i => i.id === compra.insumo_id);
                                return (
                                    <tr key={compra.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6 text-sm text-slate-700">
                                            {new Date(compra.data_compra).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="py-4 px-6 text-sm font-medium text-slate-900">
                                            {compra.fornecedor}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-slate-700">
                                            {insumo ? insumo.nome : 'Insumo não encontrado'}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-right text-slate-700">
                                            {compra.quantidade} {insumo?.unidade_medida}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-right text-slate-700">
                                            {compra.preco_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-right font-semibold text-slate-900">
                                            {compra.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <button 
                                                onClick={() => handleDelete(compra.id)}
                                                className="text-slate-400 hover:text-danger-600 transition-colors"
                                                title="Excluir Compra"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredCompras.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-slate-500">
                                        Nenhuma compra registrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default PurchasesPanel;
