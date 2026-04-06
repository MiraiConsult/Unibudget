import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { supabase } from '../services/supabaseClient';
import type { InsumoEspecial, InsumoEspecialOpcao } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { Plus, Trash2, List, Settings, ChevronRight } from 'lucide-react';
import Spinner from './ui/Spinner';

const SpecialInputsManager: React.FC = () => {
    const { insumos, insumosEspeciais, insumosEspeciaisOpcoes, fetchData } = useData();
    const { showNotification } = useNotification();

    const [selectedSpecialInput, setSelectedSpecialInput] = useState<InsumoEspecial | null>(null);
    const [newSpecialInputName, setNewSpecialInputName] = useState('');
    const [newOptionInsumoId, setNewOptionInsumoId] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleAddSpecialInput = async () => {
        if (!newSpecialInputName.trim()) {
            showNotification('O nome do insumo especial não pode ser vazio.', 'warning');
            return;
        }
        setLoading(true);
        const { data, error } = await supabase
            .from('insumos_especiais')
            .insert({ nome: newSpecialInputName.trim() })
            .select()
            .single();

        if (error) {
            showNotification(`Erro ao criar insumo especial: ${error.message}`, 'danger');
        } else {
            showNotification('Insumo especial criado com sucesso!', 'success');
            setNewSpecialInputName('');
            await fetchData();
            setSelectedSpecialInput(data);
        }
        setLoading(false);
    };
    
    const handleDeleteSpecialInput = async (id: number) => {
        if(window.confirm('Tem certeza? Isso também removerá todas as opções associadas e o insumo de qualquer ficha técnica.')) {
            setLoading(true);
            const { error: optionsError } = await supabase.from('insumos_especiais_opcoes').delete().eq('insumo_especial_id', id);
            if (optionsError) {
                showNotification(`Erro ao remover opções: ${optionsError.message}`, 'danger');
                setLoading(false);
                return;
            }

            const { error: fichaError } = await supabase.from('fichas_tecnicas').delete().eq('insumo_especial_id', id);
             if (fichaError) {
                showNotification(`Erro ao remover de fichas: ${fichaError.message}`, 'danger');
                setLoading(false);
                return;
            }

            const { error } = await supabase.from('insumos_especiais').delete().eq('id', id);
            if (error) {
                 showNotification(`Erro ao deletar insumo especial: ${error.message}`, 'danger');
            } else {
                showNotification('Insumo especial deletado.', 'success');
                await fetchData();
                setSelectedSpecialInput(null);
            }
             setLoading(false);
        }
    };

    const handleAddOption = async () => {
        if (!selectedSpecialInput || !newOptionInsumoId) return;
        setLoading(true);
        const { error } = await supabase.from('insumos_especiais_opcoes').insert({
            insumo_especial_id: selectedSpecialInput.id,
            insumo_id: parseInt(newOptionInsumoId)
        });

        if (error) {
            showNotification(`Erro ao adicionar opção: ${error.message}`, 'danger');
        } else {
            showNotification('Opção adicionada!', 'success');
            await fetchData();
            setNewOptionInsumoId('');
        }
        setLoading(false);
    };

    const handleDeleteOption = async (optionId: number) => {
        setLoading(true);
        const { error } = await supabase.from('insumos_especiais_opcoes').delete().eq('id', optionId);
        if (error) {
            showNotification(`Erro ao remover opção: ${error.message}`, 'danger');
        } else {
            showNotification('Opção removida.', 'success');
            await fetchData();
        }
         setLoading(false);
    };

    const currentOptions = useMemo(() => {
        if (!selectedSpecialInput) return [];
        return insumosEspeciaisOpcoes
            .filter(opt => opt.insumo_especial_id === selectedSpecialInput.id)
            .map(opt => ({
                ...opt,
                insumo: insumos.find(i => i.id === opt.insumo_id)
            }))
            .filter(opt => opt.insumo); // Filter out options where insumo might not exist
    }, [selectedSpecialInput, insumosEspeciaisOpcoes, insumos]);

    const availableInsumosForOptions = useMemo(() => {
        const currentOptionIds = new Set(currentOptions.map(opt => opt.insumo_id));
        return insumos.filter(insumo => !currentOptionIds.has(insumo.id));
    }, [insumos, currentOptions]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: List of Special Inputs */}
            <div className="md:col-span-1 bg-slate-50 p-4 rounded-lg border">
                 <h3 className="font-semibold text-slate-800 mb-3 flex items-center"><List size={18} className="mr-2 text-slate-500"/> Categorias Especiais</h3>
                 <div className="space-y-1 mb-4 max-h-80 overflow-y-auto">
                    {insumosEspeciais.map(is => (
                        <button 
                            key={is.id}
                            onClick={() => setSelectedSpecialInput(is)}
                            className={`w-full text-left p-2 rounded-md text-sm font-medium flex justify-between items-center ${selectedSpecialInput?.id === is.id ? 'bg-primary-100 text-primary-700' : 'text-slate-700 hover:bg-slate-200'}`}
                        >
                            {is.nome}
                            <ChevronRight size={16} />
                        </button>
                    ))}
                 </div>
                 <div className="flex space-x-2">
                     <input
                        type="text"
                        value={newSpecialInputName}
                        onChange={e => setNewSpecialInputName(e.target.value)}
                        placeholder="Nova categoria"
                        className="flex-grow p-2 border bg-white border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-primary-500"
                     />
                     <button onClick={handleAddSpecialInput} disabled={loading} className="p-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-slate-400"><Plus size={20}/></button>
                 </div>
            </div>

            {/* Right Column: Options for selected Special Input */}
            <div className="md:col-span-2">
                {selectedSpecialInput ? (
                    <div className="p-4 rounded-lg border bg-white">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="font-semibold text-slate-800 flex items-center"><Settings size={18} className="mr-2 text-slate-500"/> Opções para: <span className="text-primary-600 ml-1.5">{selectedSpecialInput.nome}</span></h3>
                             <button onClick={() => handleDeleteSpecialInput(selectedSpecialInput.id)} disabled={loading} className="text-danger-600 hover:text-danger-800 text-sm font-medium flex items-center disabled:text-slate-400">
                                 <Trash2 size={14} className="mr-1"/> Excluir Categoria
                             </button>
                        </div>

                         <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
                            {currentOptions.length > 0 ? currentOptions.map(opt => (
                                <div key={opt.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-md">
                                    <span className="text-sm text-slate-800 font-medium">{opt.insumo?.nome}</span>
                                    <button onClick={() => handleDeleteOption(opt.id)} disabled={loading} className="text-slate-400 hover:text-danger-600"><Trash2 size={16}/></button>
                                </div>
                            )) : <p className="text-sm text-slate-500 text-center py-4">Nenhuma opção adicionada.</p>}
                         </div>

                         <div className="flex space-x-2 border-t pt-4">
                             <select
                                value={newOptionInsumoId}
                                onChange={e => setNewOptionInsumoId(e.target.value)}
                                className="flex-grow p-2 border bg-white border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-primary-500"
                             >
                                <option value="">Selecione um insumo</option>
                                {availableInsumosForOptions.map(insumo => (
                                    <option key={insumo.id} value={insumo.id}>{insumo.nome}</option>
                                ))}
                             </select>
                            <button onClick={handleAddOption} disabled={loading || !newOptionInsumoId} className="p-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-slate-400">
                                <Plus size={20}/>
                            </button>
                         </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full p-10 text-center text-slate-500 border-2 border-dashed rounded-lg">
                        Selecione uma categoria à esquerda para gerenciar suas opções.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpecialInputsManager;
