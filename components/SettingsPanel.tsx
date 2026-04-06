import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { supabase } from '../services/supabaseClient';
import type { ParametrosGlobais } from '../types';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { useNotification } from '../contexts/NotificationContext';
import Spinner from './ui/Spinner';

const SettingsPanel: React.FC = () => {
    const { parametros, fetchData } = useData();
    const { showNotification } = useNotification();
    const [formState, setFormState] = useState<Partial<ParametrosGlobais>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (parametros) {
            setFormState(parametros);
        }
    }, [parametros]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormState({ ...formState, [e.target.name]: value === '' ? null : parseFloat(value) });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.id) return;
        setIsSaving(true);
        
        const { id, ...updateData } = formState;

        const { error } = await supabase
            .from('parametros_globais')
            .update(updateData)
            .eq('id', id);

        if (error) {
            showNotification(`Erro ao salvar: ${error.message}`, 'danger');
        } else {
            showNotification("Configurações salvas com sucesso!", 'success');
            await fetchData();
        }
        setIsSaving(false);
    };

    if (!parametros) {
        return <div className="flex justify-center items-center p-10"><Spinner /></div>;
    }

    const fields = [
        { name: 'markup_p1', label: 'Markup P1 (Fator)', description: 'Multiplicador para o preço de varejo.' },
        { name: 'markup_p2', label: 'Markup P2 (Fator)', description: 'Multiplicador para o preço de atacado.' },
        { name: 'markup_p3', label: 'Markup P3 (Fator)', description: 'Multiplicador para preço especial.' },
        { name: 'taxa_imposto', label: 'Taxa de Imposto (%)', description: 'Percentual de imposto sobre a venda.' },
        { name: 'taxa_comissao', label: 'Taxa de Comissão (%)', description: 'Percentual de comissão para o vendedor.' },
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Configurações Globais</h1>
                <p className="text-slate-500 mt-1">Ajuste os parâmetros de precificação e custos para todo o sistema.</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Parâmetros de Precificação e Custos</CardTitle>
                </CardHeader>
                <form onSubmit={handleSave} className="space-y-6">
                    {fields.map(field => (
                        <div key={field.name} className="grid grid-cols-1 md:grid-cols-3 items-center gap-2">
                            <div className="md:col-span-1">
                                <label htmlFor={field.name} className="block text-sm font-medium text-slate-700">{field.label}</label>
                                <p className="mt-1 text-xs text-slate-500">{field.description}</p>
                            </div>
                            <div className="md:col-span-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    id={field.name}
                                    name={field.name}
                                    value={formState[field.name as keyof ParametrosGlobais] ?? ''}
                                    onChange={handleChange}
                                    className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                />
                            </div>
                        </div>
                    ))}
                    
                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full md:w-auto flex justify-center py-2.5 px-6 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-slate-400"
                        >
                            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default SettingsPanel;