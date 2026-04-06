import React, { useState, useEffect } from 'react';
import { X, Check, PackageMinus } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import type { Insumo } from '../../types';

interface ConsumoModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialInsumoId?: number | null;
}

const ConsumoModal: React.FC<ConsumoModalProps> = ({ isOpen, onClose, initialInsumoId }) => {
    const { insumos, addConsumo, compras, consumos, funcionarios } = useData();
    const { showNotification } = useNotification();
    
    const [insumoId, setInsumoId] = useState<number | ''>('');
    const [quantidade, setQuantidade] = useState<string>('');
    const [motivo, setMotivo] = useState<string>('Produção');
    const [codigoAcesso, setCodigoAcesso] = useState<string>('');

    useEffect(() => {
        if (isOpen && initialInsumoId) {
            setInsumoId(initialInsumoId);
        } else if (isOpen && !initialInsumoId) {
            setInsumoId('');
        }
    }, [isOpen, initialInsumoId]);

    if (!isOpen) return null;

    const selectedInsumo = insumos.find(i => i.id === insumoId);

    // Calculate current stock for the selected item
    const currentStock = selectedInsumo ? (() => {
        const totalCompras = compras.filter(c => c.insumo_id === selectedInsumo.id).reduce((sum, c) => sum + Number(c.quantidade), 0);
        const totalConsumos = consumos.filter(c => c.insumo_id === selectedInsumo.id).reduce((sum, c) => sum + Number(c.quantidade), 0);
        return totalCompras - totalConsumos;
    })() : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!insumoId || !quantidade) {
            showNotification('Preencha os campos obrigatórios', 'warning');
            return;
        }

        const qtd = parseFloat(quantidade);
        if (isNaN(qtd) || qtd <= 0) {
            showNotification('Quantidade inválida', 'danger');
            return;
        }

        if (qtd > currentStock) {
            if (!window.confirm(`Atenção: A quantidade informada (${qtd}) é maior que o estoque atual (${currentStock}). Deseja continuar mesmo assim?`)) {
                return;
            }
        }

        const funcionario = funcionarios.find(f => f.codigo_acesso === codigoAcesso);
        if (!funcionario) {
            showNotification('Código de acesso inválido ou não encontrado.', 'danger');
            return;
        }

        const success = await addConsumo({
            data_consumo: new Date().toISOString().split('T')[0],
            insumo_id: Number(insumoId),
            quantidade: qtd,
            motivo: motivo || null,
            responsavel: funcionario.nome,
            funcionario_id: funcionario.id
        });

        if (success) {
            showNotification('Consumo registrado com sucesso!', 'success');
            setQuantidade('');
            setMotivo('Produção');
            setCodigoAcesso('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-primary-50">
                    <h2 className="text-lg font-bold text-primary-900 flex items-center">
                        <PackageMinus size={20} className="mr-2 text-primary-600" />
                        Registrar Consumo / Saída
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Insumo</label>
                        <select
                            value={insumoId}
                            onChange={(e) => setInsumoId(Number(e.target.value))}
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-slate-50"
                            required
                            disabled={!!initialInsumoId} // Lock if opened via QR Code
                        >
                            <option value="">Selecione o insumo...</option>
                            {insumos.map(insumo => (
                                <option key={insumo.id} value={insumo.id}>
                                    {insumo.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedInsumo && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                            <span className="text-sm text-slate-500">Estoque Atual:</span>
                            <span className={`font-bold ${currentStock <= 0 ? 'text-danger-600' : 'text-success-600'}`}>
                                {currentStock} {selectedInsumo.unidade_medida}
                            </span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade a Retirar</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={quantidade}
                                onChange={(e) => setQuantidade(e.target.value)}
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-lg font-semibold"
                                required
                                autoFocus
                            />
                            {selectedInsumo && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                                    {selectedInsumo.unidade_medida}
                                </span>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / Destino</label>
                        <select
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="Produção">Produção (Corte/Costura)</option>
                            <option value="Perda/Avaria">Perda / Avaria</option>
                            <option value="Ajuste de Inventário">Ajuste de Inventário (Falta)</option>
                            <option value="Outros">Outros</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código de Acesso do Funcionário</label>
                        <input
                            type="password"
                            placeholder="Digite seu código"
                            value={codigoAcesso}
                            onChange={(e) => setCodigoAcesso(e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono"
                            required
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 flex justify-center items-center px-4 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                        >
                            <Check size={18} className="mr-2" />
                            Confirmar Saída
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConsumoModal;
