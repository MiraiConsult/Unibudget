import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { supabase } from '../services/supabaseClient';
import { Card } from './ui/Card';
import { Pencil, Trash2, Copy, Upload, Plus, Edit2, Search, Save, X, AlertTriangle, Users } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import ImportModal from './modals/ImportModal';
import SpecialInputsManager from './SpecialInputsManager';
import type { Funcionario } from '../types';

type AdminTab = 'insumos' | 'insumos_especiais' | 'produtos' | 'adicionais' | 'vendedores' | 'funcionarios';

const AdminPanel: React.FC = () => {
    const { insumos, produtosBase, adicionais, vendedores, funcionarios, fetchData, recalculateProdutoCost } = useData();
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState<AdminTab>('insumos');
    const [editRow, setEditRow] = useState<any>(null);
    const [newRow, setNewRow] = useState<any>({});
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    // Funcionarios State
    const [editingFuncionario, setEditingFuncionario] = useState<Partial<Funcionario> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleEdit = (row: any) => setEditRow({ ...row });
    const handleCancel = () => {
        setEditRow(null);
        setNewRow({});
    };

    const handleSave = async () => {
        if (!editRow) return;
        const { id, ...updateData } = editRow;
        
        const tableName = activeTab === 'produtos' ? 'produtos_base' : activeTab;

        const { error } = await supabase.from(tableName).update(updateData).eq('id', id);

        if (error) {
            console.error("Update error:", error.message);
            showNotification(`Falha ao salvar: ${error.message}`, 'danger');
        } else {
            showNotification('Item salvo com sucesso!', 'success');
            fetchData();
            handleCancel();
        }
    };
    
    const handleAdd = async () => {
        const tableName = activeTab === 'produtos' ? 'produtos_base' : activeTab;
        let payload: any;

        switch (tableName) {
            case 'insumos':
                if (!newRow.nome || !newRow.unidade_medida || typeof newRow.custo_unitario !== 'number') {
                    showNotification('Preencha os campos obrigatórios: Nome, Unidade e Custo Unitário.', 'warning');
                    return;
                }
                payload = {
                    nome: newRow.nome,
                    unidade_medida: newRow.unidade_medida,
                    custo_unitario: newRow.custo_unitario
                };
                break;
            case 'produtos_base':
                if (!newRow.nome) {
                    showNotification('O campo obrigatório Nome deve ser preenchido.', 'warning');
                    return;
                }
                payload = {
                    nome: newRow.nome,
                    preco_venda_manual: newRow.preco_venda_manual ?? null
                };
                break;
            case 'adicionais':
                if (!newRow.tipo_adicional || !newRow.nome_opcao || typeof newRow.custo_adicional !== 'number') {
                    showNotification('Preencha os campos obrigatórios: Tipo, Opção e Custo Adicional.', 'warning');
                    return;
                }
                payload = {
                    tipo_adicional: newRow.tipo_adicional,
                    nome_opcao: newRow.nome_opcao,
                    custo_adicional: newRow.custo_adicional,
                    preco_venda: newRow.preco_venda ?? null
                };
                break;
            case 'vendedores':
                if (!newRow.nome) {
                    showNotification('O campo obrigatório Nome deve ser preenchido.', 'warning');
                    return;
                }
                payload = { nome: newRow.nome };
                break;
            default:
                return;
        }

        const { error } = await supabase.from(tableName).insert(payload);

        if (error) {
            console.error("Insert error:", error.message);
            showNotification(`Falha ao adicionar: ${error.message}`, 'danger');
        } else {
            showNotification('Item adicionado com sucesso!', 'success');
            fetchData();
            handleCancel();
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Tem certeza que deseja excluir este item?')) {
            const tableName = activeTab === 'produtos' ? 'produtos_base' : activeTab;

            // Produto: remove dependências antes de deletar
            if (tableName === 'produtos_base') {
                // 1. Remove fichas técnicas do produto
                const { error: fichaError } = await supabase
                    .from('fichas_tecnicas').delete().eq('produto_base_id', id);
                if (fichaError) {
                    showNotification(`Falha ao remover fichas técnicas: ${fichaError.message}`, 'danger');
                    return;
                }
                // 2. Remove itens de orçamento que referenciam o produto
                const { error: itemError } = await supabase
                    .from('orcamento_itens').delete().eq('produto_base_id', id);
                if (itemError) {
                    showNotification(`Falha ao remover itens de orçamento: ${itemError.message}`, 'danger');
                    return;
                }
                // 3. Remove layouts externos que referenciam o produto
                await supabase.from('pedido_layouts_externos').update({ produto_base_id: null }).eq('produto_base_id', id);
                // 4. Remove do mapa de produtos externos
                await supabase.from('produto_externo_mapa').delete().eq('produto_base_id', id);
            }

            // Insumo: remove fichas técnicas que o referenciam
            if (tableName === 'insumos') {
                await supabase.from('fichas_tecnicas').delete().eq('insumo_id', id);
            }

            const { error } = await supabase.from(tableName).delete().eq('id', id);

            if (error) {
                console.error("Delete error:", error.message);
                showNotification(`Falha ao excluir: ${error.message}`, 'danger');
            } else {
                showNotification('Item excluído com sucesso!', 'success');
                fetchData();
            }
        }
    };

    const handleSaveFuncionario = async () => {
        if (!editingFuncionario?.nome || !editingFuncionario?.codigo_acesso) {
            showNotification("Nome e Código de Acesso são obrigatórios.", "warning");
            return;
        }

        try {
            if (editingFuncionario.id) {
                const { error } = await supabase.from('funcionarios').update(editingFuncionario).eq('id', editingFuncionario.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('funcionarios').insert([editingFuncionario]);
                if (error) throw error;
            }
            setEditingFuncionario(null);
            showNotification("Funcionário salvo com sucesso!", "success");
            fetchData();
        } catch (error: any) {
            console.error('Error saving funcionario:', error);
            if (error.code === '23505') { // Unique violation
                showNotification("Este código de acesso já está em uso por outro funcionário.", "danger");
            } else {
                // Fallback to localStorage if Supabase fails
                console.warn("Usando localStorage para funcionarios");
                const local = localStorage.getItem('unibudget_funcionarios');
                let localFuncionarios: Funcionario[] = local ? JSON.parse(local) : [];
                
                if (localFuncionarios.some(f => f.codigo_acesso === editingFuncionario.codigo_acesso && f.id !== editingFuncionario.id)) {
                    showNotification("Este código de acesso já está em uso por outro funcionário.", "danger");
                    return;
                }

                if (editingFuncionario.id) {
                    localFuncionarios = localFuncionarios.map(f => f.id === editingFuncionario.id ? { ...f, ...editingFuncionario } as Funcionario : f);
                } else {
                    localFuncionarios.push({ ...editingFuncionario, id: Date.now(), created_at: new Date().toISOString() } as Funcionario);
                }
                localStorage.setItem('unibudget_funcionarios', JSON.stringify(localFuncionarios));
                setEditingFuncionario(null);
                showNotification("Funcionário salvo localmente com sucesso!", "success");
                fetchData();
            }
        }
    };

    const handleDeleteFuncionario = async (id: number) => {
        if (!window.confirm('Tem certeza que deseja excluir este funcionário?')) return;
        try {
            const { error } = await supabase.from('funcionarios').delete().eq('id', id);
            if (error) throw error;
            showNotification("Funcionário excluído com sucesso!", "success");
            fetchData();
        } catch (error) {
            console.error('Error deleting funcionario:', error);
            // Fallback
            const local = localStorage.getItem('unibudget_funcionarios');
            if (local) {
                const localFuncionarios: Funcionario[] = JSON.parse(local);
                localStorage.setItem('unibudget_funcionarios', JSON.stringify(localFuncionarios.filter(f => f.id !== id)));
                showNotification("Funcionário excluído localmente com sucesso!", "success");
                fetchData();
            }
        }
    };
    
    const handleDuplicate = async (row: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...originalData } = row;
        const nameKey = activeTab === 'adicionais' ? 'tipo_adicional' : 'nome';
        const duplicatedName = `${originalData[nameKey]} (Cópia)`;

        const newData = { ...originalData, [nameKey]: duplicatedName };

        try {
            if (activeTab === 'produtos') {
                const { data: newProductData, error: newProductError } = await supabase
                    .from('produtos_base')
                    .insert({ ...newData, custo_calculado: row.custo_calculado })
                    .select()
                    .single();

                if (newProductError) throw newProductError;
                
                const { data: fichaTecnicaItems, error: fichaError } = await supabase
                    .from('fichas_tecnicas')
                    .select('*')
                    .eq('produto_base_id', id);
                
                if (fichaError) throw fichaError;

                if (fichaTecnicaItems && fichaTecnicaItems.length > 0) {
                    const newFichaItems = fichaTecnicaItems.map(item => ({
                        produto_base_id: newProductData.id,
                        insumo_id: item.insumo_id,
                        insumo_especial_id: item.insumo_especial_id,
                        quantidade: item.quantidade
                    }));
                    const { error: newFichaError } = await supabase.from('fichas_tecnicas').insert(newFichaItems);
                    if (newFichaError) throw newFichaError;
                }
                 await recalculateProdutoCost(newProductData.id);


            } else {
                const tableName = activeTab;
                const { error } = await supabase.from(tableName).insert(newData);
                if (error) throw error;
            }

            showNotification('Item duplicado com sucesso!', 'success');
            await fetchData();

        } catch(error: any) {
            console.error("Duplicate error:", error.message);
            showNotification(`Falha ao duplicar: ${error.message}`, 'danger');
        }
    };


    const renderTable = () => {
        let data: any[] = [];
        let columns: { key: string, label: string, type?: string }[] = [];

        switch (activeTab) {
            case 'insumos':
                data = insumos;
                columns = [
                    { key: 'nome', label: 'Nome' },
                    { key: 'unidade_medida', label: 'Unidade' },
                    { key: 'custo_unitario', label: 'Custo Unitário', type: 'number' }
                ];
                break;
            case 'produtos':
                data = produtosBase;
                columns = [
                    { key: 'nome', label: 'Nome' },
                    { key: 'preco_venda_manual', label: 'Preço Manual', type: 'number' },
                    { key: 'custo_calculado', label: 'Custo Calculado', type: 'disabled' },
                ];
                break;
            case 'adicionais':
                data = adicionais;
                columns = [
                    { key: 'tipo_adicional', label: 'Tipo' },
                    { key: 'nome_opcao', label: 'Opção' },
                    { key: 'custo_adicional', label: 'Custo Adicional', type: 'number' },
                    { key: 'preco_venda', label: 'Preço Venda', type: 'number' }
                ];
                break;
            case 'vendedores':
                data = vendedores;
                columns = [{ key: 'nome', label: 'Nome' }];
                break;
        }

        const renderInput = (col: any, row: any, isEdit: boolean) => {
             const value = isEdit ? editRow[col.key] : newRow[col.key];
             const displayValue = value ?? '';

             const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const rawValue = e.target.value;
                let finalValue: string | number | null = rawValue;

                if (col.type === 'number') {
                    if (rawValue.trim() === '') {
                        finalValue = null;
                    } else {
                        const parsed = parseFloat(rawValue);
                        finalValue = isNaN(parsed) ? null : parsed;
                    }
                }
                
                if (isEdit) {
                    setEditRow({ ...editRow, [col.key]: finalValue });
                } else {
                    setNewRow({ ...newRow, [col.key]: finalValue });
                }
             };

             if (col.type === 'disabled') return <span className="text-slate-500">{row[col.key]?.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>;
             
             return <input 
                type={col.type === 'number' ? 'number' : 'text'} 
                step={col.type === 'number' ? 'any' : undefined}
                value={displayValue} 
                onChange={onChange} 
                className="p-2 border bg-slate-50 border-slate-200 rounded-md w-full focus:ring-2 focus:ring-primary-500"
             />
        }

        return (
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead className="bg-slate-50">
                        <tr>
                            {columns.map(c => <th key={c.key} className="py-3 px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.label}</th>)}
                            <th className="py-3 px-6 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map(row => (
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                {columns.map(col => (
                                    <td key={col.key} className="py-4 px-6 text-sm text-slate-700">
                                        {editRow?.id === row.id ? renderInput(col, row, true) : (col.type === 'number' && typeof row[col.key] === 'number' ? row[col.key].toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : row[col.key])}
                                    </td>
                                ))}
                                <td className="py-4 px-6 text-right">
                                    {editRow?.id === row.id ? (
                                        <div className="flex items-center justify-end space-x-2">
                                            <button onClick={handleSave} className="text-white bg-success-500 hover:bg-success-600 px-3 py-1 rounded-md text-sm font-medium">Salvar</button>
                                            <button onClick={handleCancel} className="text-slate-700 bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded-md text-sm font-medium">Cancelar</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end space-x-4">
                                            <button onClick={() => handleDuplicate(row)} title="Duplicar" className="text-slate-400 hover:text-green-600 transition-colors"><Copy size={18} /></button>
                                            <button onClick={() => handleEdit(row)} title="Editar" className="text-slate-400 hover:text-primary-600 transition-colors"><Pencil size={18} /></button>
                                            <button onClick={() => handleDelete(row.id)} title="Excluir" className="text-slate-400 hover:text-danger-600 transition-colors"><Trash2 size={18} /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                         <tr className="bg-slate-100">
                            {columns.map(col => (
                                <td key={col.key} className="py-3 px-6">
                                    {col.type !== 'disabled' && renderInput(col, {}, false)}
                                </td>
                            ))}
                            <td className="py-3 px-6 text-right">
                                <button onClick={handleAdd} className="text-primary-600 font-semibold hover:text-primary-700 transition-colors text-sm">Adicionar Novo</button>
                            </td>
                         </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Cadastros Gerais</h1>
                    <p className="text-slate-500 mt-1">Adicione e gerencie insumos, produtos, adicionais e vendedores.</p>
                </div>
                <button 
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center justify-center px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg shadow hover:bg-primary-700 transition-all self-start md:self-center"
                >
                    <Upload size={18} className="mr-2"/>
                    Importar Dados
                </button>
            </div>
            <Card>
                <div className="flex border-b border-slate-200 overflow-x-auto">
                    {(['insumos', 'insumos_especiais', 'produtos', 'adicionais', 'vendedores', 'funcionarios'] as AdminTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); handleCancel(); }}
                            className={`relative capitalize py-3 px-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'text-primary-600' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {tab.replace('_', ' ')}
                            {activeTab === tab && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-primary-600 rounded-full"/>}
                        </button>
                    ))}
                </div>
                <div className="pt-4">
                  {activeTab === 'insumos_especiais' ? <SpecialInputsManager /> : activeTab !== 'funcionarios' ? renderTable() : null}
                </div>
            </Card>
            <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
            {/* Funcionarios Tab */}
            {activeTab === 'funcionarios' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar funcionário..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        <button
                            onClick={() => setEditingFuncionario({ nome: '', codigo_acesso: '', setor: '' })}
                            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            <Plus size={20} className="mr-2" />
                            Novo Funcionário
                        </button>
                    </div>

                    {editingFuncionario && (
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">
                                {editingFuncionario.id ? 'Editar Funcionário' : 'Novo Funcionário'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                                    <input
                                        type="text"
                                        value={editingFuncionario.nome || ''}
                                        onChange={(e) => setEditingFuncionario({ ...editingFuncionario, nome: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Setor</label>
                                    <input
                                        type="text"
                                        value={editingFuncionario.setor || ''}
                                        onChange={(e) => setEditingFuncionario({ ...editingFuncionario, setor: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        placeholder="Ex: Produção, Estoque"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Código de Acesso</label>
                                    <input
                                        type="text"
                                        value={editingFuncionario.codigo_acesso || ''}
                                        onChange={(e) => setEditingFuncionario({ ...editingFuncionario, codigo_acesso: e.target.value })}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                        placeholder="Ex: 1234"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Usado para registrar consumo via QR Code.</p>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end space-x-3">
                                <button
                                    onClick={() => setEditingFuncionario(null)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveFuncionario}
                                    className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                >
                                    <Save size={20} className="mr-2" />
                                    Salvar
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="py-3 px-4 text-sm font-semibold text-slate-600">Nome</th>
                                    <th className="py-3 px-4 text-sm font-semibold text-slate-600">Setor</th>
                                    <th className="py-3 px-4 text-sm font-semibold text-slate-600">Código de Acesso</th>
                                    <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {funcionarios
                                    .filter(f => f.nome.toLowerCase().includes(searchTerm.toLowerCase()) || (f.setor && f.setor.toLowerCase().includes(searchTerm.toLowerCase())))
                                    .map(funcionario => (
                                        <tr key={funcionario.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 text-sm text-slate-800">{funcionario.nome}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{funcionario.setor || '-'}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600 font-mono">{funcionario.codigo_acesso}</td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => setEditingFuncionario(funcionario)}
                                                    className="p-1.5 text-slate-400 hover:text-primary-600 transition-colors"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteFuncionario(funcionario.id)}
                                                    className="p-1.5 text-slate-400 hover:text-danger-600 transition-colors ml-2"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;