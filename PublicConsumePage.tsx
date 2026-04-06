import React, { useState, useEffect } from 'react';
import { useData } from './contexts/DataContext';
import { useNotification } from './contexts/NotificationContext';
import { PackageMinus, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import Spinner from './components/ui/Spinner';

const PublicConsumePage: React.FC = () => {
    const { insumos, compras, consumos, funcionarios, addConsumo, loading } = useData();
    const { showNotification } = useNotification();
    
    const [insumoId, setInsumoId] = useState<number | null>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [quantidade, setQuantidade] = useState<string>('');
    const [motivo, setMotivo] = useState<string>('Produção');
    const [codigoAcesso, setCodigoAcesso] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('insumo_id');
        if (id) {
            setInsumoId(Number(id));
        }
        const t = params.get('tenant_id');
        if (t) setTenantId(t);
    }, []);

    // Filtra tudo pelo tenant_id da URL para evitar vazamento entre
    // empresas no fluxo público (QR Code). Se o QR não tiver tenant_id
    // (etiquetas antigas), fica em modo legado sem filtro — nesse caso
    // o insert irá falhar por NOT NULL e o operador verá um erro.
    const tenantFilter = <T extends { tenant_id?: string | null }>(rows: T[]) =>
        tenantId ? rows.filter(r => (r as any).tenant_id === tenantId) : rows;
    const insumosScoped = tenantFilter(insumos as any);
    const comprasScoped = tenantFilter(compras as any);
    const consumosScoped = tenantFilter(consumos as any);
    const funcionariosScoped = tenantFilter(funcionarios as any);

    const handleBack = () => {
        window.location.href = window.location.origin;
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-100">
                <Spinner />
            </div>
        );
    }

    const selectedInsumo = insumosScoped.find(i => i.id === insumoId);

    if (!selectedInsumo) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-100 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full relative">
                    <button onClick={handleBack} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600">
                        <ArrowLeft size={24} />
                    </button>
                    <AlertTriangle size={48} className="mx-auto text-warning-500 mb-4 mt-4" />
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Insumo não encontrado</h2>
                    <p className="text-slate-600 mb-4">O QR Code lido não corresponde a um insumo válido ou o insumo foi removido.</p>
                    
                    <div className="text-left bg-slate-100 p-3 rounded-lg text-xs text-slate-500 mb-6 font-mono border border-slate-200">
                        <p className="font-bold text-slate-700 mb-1">Informações de Diagnóstico:</p>
                        <p>ID na URL: {insumoId ? insumoId : 'Nenhum ID encontrado'}</p>
                        <p>Insumos carregados (tenant): {insumosScoped.length} / {insumos.length} total</p>
                        <p>Tenant da URL: {tenantId || '(ausente)'}</p>
                        {insumosScoped.length === 0 && (
                            <p className="text-danger-600 mt-2 font-semibold">
                                ⚠️ Zero insumos carregados. Isso geralmente indica que as permissões do banco de dados (RLS) não foram aplicadas para usuários anônimos.
                            </p>
                        )}
                    </div>

                    <button onClick={handleBack} className="w-full py-3 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors">
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    const currentStock = (() => {
        const totalCompras = comprasScoped.filter(c => c.insumo_id === selectedInsumo.id).reduce((sum, c) => sum + Number(c.quantidade), 0);
        const totalConsumos = consumosScoped.filter(c => c.insumo_id === selectedInsumo.id).reduce((sum, c) => sum + Number(c.quantidade), 0);
        return totalCompras - totalConsumos;
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!quantidade) {
            showNotification('Informe a quantidade', 'warning');
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

        const funcionario = funcionariosScoped.find(f => f.codigo_acesso === codigoAcesso);
        if (!funcionario) {
            showNotification('Código de acesso inválido ou não encontrado.', 'danger');
            return;
        }

        if (!tenantId) {
            showNotification('QR Code sem tenant_id. Gere uma etiqueta nova a partir do sistema.', 'danger');
            return;
        }

        setIsSubmitting(true);
        const success = await addConsumo({
            data_consumo: new Date().toISOString().split('T')[0],
            insumo_id: selectedInsumo.id,
            quantidade: qtd,
            motivo: motivo || null,
            responsavel: funcionario.nome,
            funcionario_id: funcionario.id,
            tenant_id: tenantId,
        });
        setIsSubmitting(false);

        if (success) {
            setSuccessMessage(`Consumo de ${qtd} ${selectedInsumo.unidade_medida} registrado com sucesso por ${funcionario.nome}.`);
            setQuantidade('');
            setCodigoAcesso('');
        } else {
            showNotification('Erro ao registrar consumo.', 'danger');
        }
    };

    if (successMessage) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-100 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full animate-fade-in relative">
                    <button onClick={handleBack} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="w-16 h-16 bg-success-100 text-success-600 rounded-full flex items-center justify-center mx-auto mb-4 mt-4">
                        <Check size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Sucesso!</h2>
                    <p className="text-slate-600 mb-6">{successMessage}</p>
                    <div className="space-y-3">
                        <button
                            onClick={() => setSuccessMessage(null)}
                            className="w-full py-3 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            Registrar nova saída
                        </button>
                        <button
                            onClick={handleBack}
                            className="w-full py-3 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors"
                        >
                            Sair
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4">
            <div className="w-full max-w-md mt-8">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden relative">
                    <button onClick={handleBack} className="absolute top-4 left-4 text-white/70 hover:text-white z-10">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="bg-primary-600 p-6 pt-10 text-white text-center">
                        <PackageMinus size={48} className="mx-auto mb-4 opacity-90" />
                        <h1 className="text-2xl font-bold mb-1">{selectedInsumo.nome}</h1>
                        <p className="text-primary-100">Registro de Saída de Estoque</p>
                    </div>
                    
                    <div className="p-6">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex justify-between items-center mb-6">
                            <span className="text-slate-600 font-medium">Estoque Atual:</span>
                            <span className={`text-2xl font-bold ${currentStock <= 0 ? 'text-danger-600' : 'text-success-600'}`}>
                                {currentStock} <span className="text-sm font-normal text-slate-500">{selectedInsumo.unidade_medida}</span>
                            </span>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade a Retirar</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="0.00"
                                        value={quantidade}
                                        onChange={(e) => setQuantidade(e.target.value)}
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-xl font-semibold text-center"
                                        required
                                        autoFocus
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                                        {selectedInsumo.unidade_medida}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / Destino</label>
                                <select
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
                                >
                                    <option value="Produção">Produção (Corte/Costura)</option>
                                    <option value="Perda/Avaria">Perda / Avaria</option>
                                    <option value="Ajuste de Inventário">Ajuste de Inventário (Falta)</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Código do Operador</label>
                                <input
                                    type="password"
                                    placeholder="Digite seu código de acesso"
                                    value={codigoAcesso}
                                    onChange={(e) => setCodigoAcesso(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-center text-lg tracking-widest"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-primary-600 text-white font-bold text-lg rounded-lg hover:bg-primary-700 transition-colors shadow-md disabled:opacity-70 flex justify-center items-center"
                            >
                                {isSubmitting ? <Spinner /> : 'Confirmar Saída'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicConsumePage;
