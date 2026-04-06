import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { supabase } from '../services/supabaseClient';
import type { ProdutoBase, FichaTecnicaItem, FichaTecnica } from '../types';
import { Plus, Trash2, Copy, BookOpen, ClipboardCopy, ChevronsRight, RefreshCcw, Calculator, Upload } from 'lucide-react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { useNotification } from '../contexts/NotificationContext';
import EmptyState from './ui/EmptyState';
import Spinner from './ui/Spinner';
import CopyFichaModal from './modals/CopyFichaModal';
import ImportModal from './modals/ImportModal';

const InsumoEspecialQuantidadeEditor: React.FC<{
    item: FichaTecnicaItem;
    onUpdate: (id: number, payload: Partial<FichaTecnica>) => Promise<void>;
}> = ({ item, onUpdate }) => {
    const [mode, setMode] = useState<'geral' | 'tamanho'>(item.quantidade !== null ? 'geral' : 'tamanho');
    const [geral, setGeral] = useState(item.quantidade ?? '');
    const [infantil, setInfantil] = useState(item.quantidade_infantil ?? '');
    const [adulto, setAdulto] = useState(item.quantidade_adulto ?? '');

    const handleSave = () => {
        let payload: Partial<FichaTecnica>;
        if (mode === 'geral') {
            const geralNum = parseFloat(String(geral));
            if (!isNaN(geralNum) && geralNum > 0) {
                payload = { quantidade: geralNum, quantidade_infantil: null, quantidade_adulto: null };
                onUpdate(item.id, payload);
            }
        } else {
            const infantilNum = parseFloat(String(infantil));
            const adultoNum = parseFloat(String(adulto));
            if (!isNaN(infantilNum) && infantilNum > 0 && !isNaN(adultoNum) && adultoNum > 0) {
                 payload = { quantidade: null, quantidade_infantil: infantilNum, quantidade_adulto: adultoNum };
                 onUpdate(item.id, payload);
            }
        }
    };
    
    useEffect(() => {
        setMode(item.quantidade !== null ? 'geral' : 'tamanho');
        setGeral(item.quantidade ?? '');
        setInfantil(item.quantidade_infantil ?? '');
        setAdulto(item.quantidade_adulto ?? '');
    }, [item]);

    return (
        <div className="space-y-2">
            <div className="flex items-center space-x-2">
                <button onClick={() => setMode('geral')} className={`px-2 py-1 text-xs rounded ${mode === 'geral' ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Geral</button>
                <button onClick={() => setMode('tamanho')} className={`px-2 py-1 text-xs rounded ${mode === 'tamanho' ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Por Tamanho</button>
            </div>
            {mode === 'geral' ? (
                <input
                    type="number"
                    step="any"
                    value={geral}
                    onChange={e => setGeral(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="p-1 border bg-white border-slate-200 rounded-md w-24 text-sm focus:ring-1 focus:ring-primary-500"
                />
            ) : (
                <div className="flex items-center space-x-2 text-sm">
                    <div className="flex items-center">
                        <label className="mr-1.5 text-xs text-slate-500">Inf:</label>
                        <input type="number" step="any" value={infantil} onChange={e => setInfantil(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="p-1 border bg-white border-slate-200 rounded-md w-20 text-sm focus:ring-1 focus:ring-primary-500" />
                    </div>
                     <div className="flex items-center">
                        <label className="mr-1.5 text-xs text-slate-500">Ad:</label>
                        <input type="number" step="any" value={adulto} onChange={e => setAdulto(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="p-1 border bg-white border-slate-200 rounded-md w-20 text-sm focus:ring-1 focus:ring-primary-500" />
                    </div>
                </div>
            )}
        </div>
    );
};


const FichasPanel: React.FC = () => {
    const { produtosBase, insumos, insumosEspeciais, insumosEspeciaisOpcoes, parametros, recalculateProdutoCost, fetchData } = useData();
    const { showNotification } = useNotification();
    const [selectedProduto, setSelectedProduto] = useState<ProdutoBase | null>(null);
    const [fichaTecnica, setFichaTecnica] = useState<FichaTecnicaItem[]>([]);
    const [newInsumoId, setNewInsumoId] = useState<string>('');
    const [newInsumoType, setNewInsumoType] = useState<'comum' | 'especial'>('comum');
    const [newQuantidadeTipo, setNewQuantidadeTipo] = useState<'geral' | 'tamanho'>('geral');
    const [newQuantidadeGeral, setNewQuantidadeGeral] = useState<number | string>('');
    const [newQuantidadeInfantil, setNewQuantidadeInfantil] = useState<number | string>('');
    const [newQuantidadeAdulto, setNewQuantidadeAdulto] = useState<number | string>('');
    
    const [loadingFicha, setLoadingFicha] = useState(false);
    const [markupKey, setMarkupKey] = useState<'markup_p1' | 'markup_p2' | 'markup_p3'>('markup_p1');
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editableProductPrice, setEditableProductPrice] = useState<string>('');
    const [isSavingPrice, setIsSavingPrice] = useState(false);
    const [simulationSelections, setSimulationSelections] = useState<Record<number, number>>({});
    const [simulationSize, setSimulationSize] = useState<'geral' | 'infantil' | 'adulto'>('geral');

    useEffect(() => {
        const fetchFichaTecnica = async () => {
            if (!selectedProduto) {
                setFichaTecnica([]);
                return;
            }
            setLoadingFicha(true);
            const { data, error } = await supabase
                .from('fichas_tecnicas')
                .select('*, insumos(*), insumos_especiais(*)')
                .eq('produto_base_id', selectedProduto.id);

            if (error) {
                console.error("Error fetching ficha tecnica:", error);
                setFichaTecnica([]);
            } else {
                setFichaTecnica(data as FichaTecnicaItem[]);
            }
            setLoadingFicha(false);
        };
        fetchFichaTecnica();
    }, [selectedProduto]);
    
    // Keeps the selected product in sync with the global state after data refreshes
    useEffect(() => {
        if (selectedProduto) {
            const newVersionOfSelectedProduct = produtosBase.find(p => p.id === selectedProduto.id);
            if (newVersionOfSelectedProduct && newVersionOfSelectedProduct.custo_calculado !== selectedProduto.custo_calculado) {
                setSelectedProduto(newVersionOfSelectedProduct);
            }
        }
    }, [produtosBase, selectedProduto]);

    useEffect(() => {
        if (selectedProduto) {
            setSimulationSelections({});
            setSimulationSize('geral');
            if (parametros) {
                const configuredMarkup = parametros[markupKey] || 1;
                const precoVenda = selectedProduto.preco_venda_manual ?? selectedProduto.custo_calculado * configuredMarkup;
                setEditableProductPrice(precoVenda.toFixed(2));
            }
        }
    }, [selectedProduto, markupKey, parametros]);

    const handleAddInsumo = async () => {
        if (!selectedProduto || !newInsumoId) return;

        let payload: Partial<FichaTecnica> = {
            produto_base_id: selectedProduto.id,
            insumo_id: newInsumoType === 'comum' ? parseInt(newInsumoId) : null,
            insumo_especial_id: newInsumoType === 'especial' ? parseInt(newInsumoId) : null,
        };
        
        if (newInsumoType === 'comum') {
            const qtd = parseFloat(String(newQuantidadeGeral));
            if (isNaN(qtd) || qtd <= 0) {
                 showNotification('Quantidade para insumo comum deve ser um número positivo.', 'warning');
                 return;
            }
            payload.quantidade = qtd;
            payload.quantidade_adulto = null;
            payload.quantidade_infantil = null;
        } else { // Insumo Especial
            if (newQuantidadeTipo === 'geral') {
                 const qtd = parseFloat(String(newQuantidadeGeral));
                 if (isNaN(qtd) || qtd <= 0) {
                     showNotification('Quantidade geral deve ser um número positivo.', 'warning');
                     return;
                 }
                 payload.quantidade = qtd;
                 payload.quantidade_adulto = null;
                 payload.quantidade_infantil = null;
            } else {
                const qtdInfantil = parseFloat(String(newQuantidadeInfantil));
                const qtdAdulto = parseFloat(String(newQuantidadeAdulto));
                 if (isNaN(qtdInfantil) || qtdInfantil <= 0 || isNaN(qtdAdulto) || qtdAdulto <= 0) {
                     showNotification('Quantidades infantil e adulto devem ser números positivos.', 'warning');
                     return;
                 }
                 payload.quantidade = null;
                 payload.quantidade_infantil = qtdInfantil;
                 payload.quantidade_adulto = qtdAdulto;
            }
        }

        const { error } = await supabase.from('fichas_tecnicas').insert(payload as FichaTecnica);

        if (error) {
            showNotification(`Falha ao adicionar insumo: ${error.message}`, 'danger');
        } else {
            showNotification('Insumo adicionado com sucesso!', 'success');
            setNewInsumoId('');
            setNewQuantidadeGeral('');
            setNewQuantidadeInfantil('');
            setNewQuantidadeAdulto('');
            await recalculateProdutoCost(selectedProduto.id);
            const { data } = await supabase.from('fichas_tecnicas').select('*, insumos(*), insumos_especiais(*)').eq('produto_base_id', selectedProduto.id);
            setFichaTecnica(data as FichaTecnicaItem[]);
        }
    };

    const handleRemoveInsumo = async (id: number) => {
        if (!selectedProduto) return;
        const { error } = await supabase.from('fichas_tecnicas').delete().eq('id', id);
        if (error) {
            showNotification(`Falha ao remover insumo: ${error.message}`, 'danger');
        } else {
            showNotification('Insumo removido com sucesso.', 'success');
            await recalculateProdutoCost(selectedProduto.id);
             const { data } = await supabase.from('fichas_tecnicas').select('*, insumos(*), insumos_especiais(*)').eq('produto_base_id', selectedProduto.id);
             setFichaTecnica(data as FichaTecnicaItem[]);
        }
    };
    
    const handleUpdateQuantities = async (id: number, payload: Partial<FichaTecnica>) => {
        if (!selectedProduto) return;
        
        const { error } = await supabase.rpc('update_ficha_tecnica_quantities', {
            p_id: id,
            p_quantidade: payload.quantidade,
            p_quantidade_adulto: payload.quantidade_adulto,
            p_quantidade_infantil: payload.quantidade_infantil,
        });
        
        if (error) {
            showNotification(`Erro ao atualizar quantidade: ${error.message}`, 'danger');
        } else {
            showNotification('Quantidade atualizada.', 'success');
            await recalculateProdutoCost(selectedProduto.id);
            const { data } = await supabase.from('fichas_tecnicas').select('*, insumos(*), insumos_especiais(*)').eq('produto_base_id', selectedProduto.id);
            setFichaTecnica(data as FichaTecnicaItem[]);
        }
    };
    
    const handleDuplicateProduct = async () => {
        if (!selectedProduto) return;
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, nome, ...rest } = selectedProduto;
        const newName = `${nome} (Cópia)`;

        try {
            const { data: newProductData, error: newProductError } = await supabase
                .from('produtos_base')
                .insert({ ...rest, nome: newName, custo_calculado: selectedProduto.custo_calculado })
                .select()
                .single();
            
            if (newProductError) throw newProductError;

            if (fichaTecnica.length > 0) {
                const newFichaItems = fichaTecnica.map(item => ({
                    produto_base_id: newProductData.id,
                    insumo_id: item.insumo_id,
                    insumo_especial_id: item.insumo_especial_id,
                    quantidade: item.quantidade,
                    quantidade_adulto: item.quantidade_adulto,
                    quantidade_infantil: item.quantidade_infantil,
                }));
                const { error: newFichaError } = await supabase.from('fichas_tecnicas').insert(newFichaItems);
                if (newFichaError) throw newFichaError;
            }
            
            await recalculateProdutoCost(newProductData.id);
            await fetchData();
            showNotification(`Produto "${nome}" duplicado para "${newName}"!`, 'success');
            setSelectedProduto(newProductData);

        } catch (error: any) {
             showNotification(`Falha ao duplicar produto: ${error.message}`, 'danger');
        }
    };

    const handleConfirmCopy = async (targetProductId: number) => {
        if (!selectedProduto || !fichaTecnica.length) {
            showNotification('Ficha técnica de origem está vazia ou nenhum produto selecionado.', 'warning');
            return;
        }

        const { data: existingFicha, error: checkError } = await supabase
            .from('fichas_tecnicas')
            .select('id')
            .eq('produto_base_id', targetProductId);

        if (checkError) {
            showNotification(`Erro ao verificar ficha de destino: ${checkError.message}`, 'danger');
            return;
        }

        if (existingFicha && existingFicha.length > 0) {
            if (!window.confirm('O produto de destino já possui uma ficha técnica. Deseja substituí-la?')) {
                return;
            }

            const { error: deleteError } = await supabase
                .from('fichas_tecnicas')
                .delete()
                .eq('produto_base_id', targetProductId);
            
            if (deleteError) {
                showNotification(`Erro ao limpar ficha de destino: ${deleteError.message}`, 'danger');
                return;
            }
        }

        const newFichaItems = fichaTecnica.map(item => ({
            produto_base_id: targetProductId,
            insumo_id: item.insumo_id,
            insumo_especial_id: item.insumo_especial_id,
            quantidade: item.quantidade,
            quantidade_adulto: item.quantidade_adulto,
            quantidade_infantil: item.quantidade_infantil,
        }));

        const { error: insertError } = await supabase
            .from('fichas_tecnicas')
            .insert(newFichaItems);

        if (insertError) {
            showNotification(`Erro ao copiar a ficha: ${insertError.message}`, 'danger');
            return;
        }

        await recalculateProdutoCost(targetProductId);
        showNotification('Ficha técnica copiada com sucesso!', 'success');
        
        const targetProduct = produtosBase.find(p => p.id === targetProductId);
        if (targetProduct) {
            setSelectedProduto(targetProduct);
        }
        
        setIsCopyModalOpen(false);
    };
    
    const handleUpdateProductPrice = async () => {
        if (!selectedProduto || isSavingPrice) return;
        
        const configuredMarkup = parametros?.[markupKey] || 1;
        const originalPrice = selectedProduto.preco_venda_manual ?? selectedProduto.custo_calculado * configuredMarkup;
        const newPriceFloat = parseFloat(editableProductPrice);

        if (!isNaN(newPriceFloat) && originalPrice.toFixed(2) === newPriceFloat.toFixed(2)) {
            return;
        }

        setIsSavingPrice(true);
        const priceToSave = !isNaN(newPriceFloat) ? newPriceFloat : null;

        const { error } = await supabase
            .from('produtos_base')
            .update({ preco_venda_manual: priceToSave })
            .eq('id', selectedProduto.id);

        if (error) {
            showNotification(`Erro ao atualizar preço: ${error.message}`, 'danger');
        } else {
            showNotification('Preço atualizado com sucesso!', 'success');
            await fetchData();
        }
        setIsSavingPrice(false);
    };

    const handleResetManualPrice = async () => {
        if (!selectedProduto || isSavingPrice) return;
        setIsSavingPrice(true);
        const { error } = await supabase
            .from('produtos_base')
            .update({ preco_venda_manual: null })
            .eq('id', selectedProduto.id);

        if (error) {
            showNotification(`Erro ao resetar preço: ${error.message}`, 'danger');
        } else {
            showNotification('Preço manual removido. Cálculo por markup reativado.', 'info');
            await fetchData();
        }
        setIsSavingPrice(false);
    };

    const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const produtosComPreco = useMemo(() => {
        if (!parametros) return produtosBase.map(p => {
            const precoVenda = p.preco_venda_manual ?? p.custo_calculado;
            const markup = p.custo_calculado > 0 ? precoVenda / p.custo_calculado : 0;
            return { ...p, precoVenda, markup };
        });
        
        return produtosBase.map(produto => {
            const custoTotal = produto.custo_calculado;
            const configuredMarkup = parametros[markupKey] || 1;
            const precoVenda = produto.preco_venda_manual ?? custoTotal * configuredMarkup;
            const markup = custoTotal > 0 ? precoVenda / custoTotal : 0;
            return { ...produto, precoVenda, markup };
        });
    }, [produtosBase, parametros, markupKey]);
    
    const selectedNewInsumo = useMemo(() => {
        if (!newInsumoId) return null;
        if (newInsumoType === 'comum') {
            return insumos.find(i => i.id === parseInt(newInsumoId));
        } else {
            return insumosEspeciais.find(i => i.id === parseInt(newInsumoId));
        }
    }, [newInsumoId, newInsumoType, insumos, insumosEspeciais]);
    
    const productSpecialInputsForFicha = useMemo(() => {
        if (!selectedProduto) return [];
        
        return fichaTecnica
          .filter(ft => ft.insumo_especial_id)
          .map(ft => {
              const specialInput = insumosEspeciais.find(is => is.id === ft.insumo_especial_id);
              const options = insumosEspeciaisOpcoes
                  .filter(opt => opt.insumo_especial_id === ft.insumo_especial_id)
                  .map(opt => insumos.find(i => i.id === opt.insumo_id))
                  .filter((i): i is NonNullable<typeof i> => !!i);
              return { ...ft, specialInput, options };
          })
          .filter(item => item.specialInput && item.options.length > 0);
    }, [selectedProduto, fichaTecnica, insumosEspeciais, insumosEspeciaisOpcoes, insumos]);
    
    const costSimulation = useMemo(() => {
        // Guard 1: We need a selected product, parameters, and some special inputs to simulate.
        if (!selectedProduto || !parametros || productSpecialInputsForFicha.length === 0) {
            return null;
        }
    
        // Guard 2: We must have a selection for ALL special inputs.
        const allInputsAreSelected = productSpecialInputsForFicha.every(
            (inputItem) => {
                const id = inputItem.insumo_especial_id;
                // Check if the id exists and the selected value is a valid, positive number
                return id && simulationSelections[id] > 0;
            }
        );
    
        if (!allInputsAreSelected) {
            return null;
        }
    
        // If all guards pass, calculate costs.
        const specialInputsCost = productSpecialInputsForFicha.reduce((total, specialInputItem) => {
            const selectedInsumoId = simulationSelections[specialInputItem.insumo_especial_id!];
            const selectedInsumo = insumos.find(i => i.id === selectedInsumoId);

            let quantityToUse = specialInputItem.quantidade;
            if (simulationSize === 'infantil' && specialInputItem.quantidade_infantil !== null) {
                quantityToUse = specialInputItem.quantidade_infantil;
            } else if (simulationSize === 'adulto' && specialInputItem.quantidade_adulto !== null) {
                quantityToUse = specialInputItem.quantidade_adulto;
            }
            
            if (selectedInsumo && quantityToUse !== null) {
                return total + (selectedInsumo.custo_unitario * quantityToUse);
            }
            return total;
        }, 0);
    
        const baseCost = selectedProduto.custo_calculado; // Cost of regular insumos
        const totalSimulatedCost = baseCost + specialInputsCost;
        
        const configuredMarkup = parametros[markupKey] || 1;
        const simulatedPrice = totalSimulatedCost * configuredMarkup;
    
        // Avoid division by zero
        const simulatedMarkup = totalSimulatedCost > 0 ? simulatedPrice / totalSimulatedCost : 0;
        
        return {
            totalSimulatedCost,
            simulatedPrice,
            simulatedMarkup
        };
    }, [selectedProduto, simulationSelections, productSpecialInputsForFicha, insumos, parametros, markupKey, simulationSize]);

    const MetricDisplay: React.FC<{ title: string; value: string; colorClass?: string }> = ({ title, value, colorClass = 'text-slate-800' }) => (
        <div className="bg-slate-50 p-3 rounded-lg text-center border">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</p>
          <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
        </div>
    );
    
    const hasSizeSpecificQuantities = useMemo(() => 
        productSpecialInputsForFicha.some(item => item.quantidade_adulto !== null || item.quantidade_infantil !== null),
    [productSpecialInputsForFicha]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Fichas Técnicas</h1>
                    <p className="text-slate-500 mt-1">Gerencie os insumos de cada produto e analise custos e preços.</p>
                </div>
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center justify-center px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg shadow hover:bg-primary-700 transition-all self-start md:self-center"
                >
                    <Upload size={18} className="mr-2" />
                    Importar Fichas
                </button>
            </div>
            
            <Card>
                 <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>
                            Editor de Ficha Técnica
                        </CardTitle>
                         {selectedProduto && (
                            <div className="flex items-center space-x-2">
                                <button 
                                    onClick={() => setIsCopyModalOpen(true)}
                                    className="flex items-center text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!fichaTecnica || fichaTecnica.length === 0 ? "A ficha técnica está vazia" : "Copiar ficha para outro produto"}
                                    disabled={!fichaTecnica || fichaTecnica.length === 0}
                                >
                                    <ClipboardCopy size={16} className="mr-2"/>
                                    Copiar Ficha
                                </button>
                                <button 
                                    onClick={handleDuplicateProduct}
                                    className="flex items-center text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-md transition-colors"
                                >
                                    <Copy size={16} className="mr-2"/>
                                    Duplicar Produto
                                </button>
                            </div>
                         )}
                    </div>
                </CardHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                        value={selectedProduto?.id || ''}
                        onChange={(e) => setSelectedProduto(produtosBase.find(p => p.id === parseInt(e.target.value)) || null)}
                        className="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                        <option value="">Selecione um Produto na lista abaixo ou aqui</option>
                        {produtosBase.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                </div>
                 {selectedProduto ? (
                    <div className="mt-4 border-t pt-4">
                         <h3 className="font-semibold text-slate-800 mb-2">Insumos para: <span className="text-primary-600">{selectedProduto.nome}</span></h3>
                        <div className="overflow-x-auto max-h-80">
                            <table className="min-w-full">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Insumo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quantidade</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Unidade</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Custo</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {loadingFicha && <tr><td colSpan={5} className="text-center p-4"><Spinner /></td></tr>}
                                    {!loadingFicha && fichaTecnica.length === 0 && <tr><td colSpan={5}><EmptyState icon={<BookOpen size={40}/>} message="Ficha Técnica Vazia" description="Adicione insumos abaixo para calcular o custo."/></td></tr>}
                                    {fichaTecnica.map(item => {
                                        const insumo = item.insumos;
                                        const insumoEspecial = item.insumos_especiais;
                                        const isSpecial = !!insumoEspecial;
                                        const name = isSpecial ? insumoEspecial.nome : insumo?.nome;
                                        const unit = isSpecial ? 'Variável' : insumo?.unidade_medida;
                                        const cost = isSpecial ? 0 : (insumo?.custo_unitario || 0) * (item.quantidade || 0);

                                        return (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 align-top">
                                                {name}
                                                {isSpecial && <span className="ml-2 text-xs font-semibold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">Especial</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 align-top">
                                                {isSpecial ? (
                                                    <InsumoEspecialQuantidadeEditor item={item} onUpdate={handleUpdateQuantities} />
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        defaultValue={item.quantidade ?? ''}
                                                        onBlur={(e) => {
                                                            const newQuantity = parseFloat(e.target.value);
                                                            if (item.quantidade !== newQuantity && !isNaN(newQuantity)) {
                                                                handleUpdateQuantities(item.id, { quantidade: newQuantity, quantidade_adulto: null, quantidade_infantil: null });
                                                            }
                                                        }}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                        className="p-1 border bg-white border-slate-200 rounded-md w-24 text-sm focus:ring-1 focus:ring-primary-500"
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 align-top">{unit}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium align-top">
                                                {isSpecial ? <span className="italic text-slate-500">Custo Variável</span> : formatCurrency(cost)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right align-top">
                                                <button onClick={() => handleRemoveInsumo(item.id)} className="text-slate-500 hover:text-danger-600 transition-colors"><Trash2 size={18} /></button>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t bg-slate-50 rounded-b-xl grid grid-cols-1 md:grid-cols-2 gap-4 items-start mt-4">
                             <div>
                                <select value={newInsumoType} onChange={e => {setNewInsumoType(e.target.value as any); setNewInsumoId('')}} className="p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500 w-full">
                                    <option value="comum">Insumo Comum</option>
                                    <option value="especial">Insumo Especial</option>
                                </select>
                             </div>
                             <div>
                                <select value={newInsumoId} onChange={e => setNewInsumoId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500">
                                    <option value="">Selecione um insumo para adicionar</option>
                                    {(newInsumoType === 'comum' ? insumos : insumosEspeciais).map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                                </select>
                                {selectedNewInsumo && newInsumoType === 'comum' && (
                                    <div className="text-xs text-slate-500 mt-1 pl-1">
                                        Custo: <span className="font-medium">{formatCurrency((selectedNewInsumo as any).custo_unitario)}</span> / {(selectedNewInsumo as any).unidade_medida}
                                    </div>
                                )}
                            </div>
                             <div className="md:col-span-2">
                                {newInsumoType === 'especial' ? (
                                    <div className="space-y-2 p-3 bg-white rounded-md border">
                                         <div className="flex items-center space-x-2">
                                            <button onClick={() => setNewQuantidadeTipo('geral')} className={`px-2 py-1 text-xs rounded ${newQuantidadeTipo === 'geral' ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Geral</button>
                                            <button onClick={() => setNewQuantidadeTipo('tamanho')} className={`px-2 py-1 text-xs rounded ${newQuantidadeTipo === 'tamanho' ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Por Tamanho</button>
                                        </div>
                                        {newQuantidadeTipo === 'geral' ? (
                                            <input type="number" placeholder="Quantidade Geral" value={newQuantidadeGeral} onChange={e => setNewQuantidadeGeral(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"/>
                                        ) : (
                                            <div className="flex items-center space-x-2">
                                                <input type="number" placeholder="Qtd. Infantil" value={newQuantidadeInfantil} onChange={e => setNewQuantidadeInfantil(e.target.value)} className="w-1/2 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"/>
                                                <input type="number" placeholder="Qtd. Adulto" value={newQuantidadeAdulto} onChange={e => setNewQuantidadeAdulto(e.target.value)} className="w-1/2 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"/>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                     <input type="number" placeholder="Quantidade" value={newQuantidadeGeral} onChange={e => setNewQuantidadeGeral(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500"/>
                                )}
                             </div>
                             <div className="md:col-span-2">
                                <button onClick={handleAddInsumo} className="w-full bg-primary-600 text-white p-2 rounded-md hover:bg-primary-700 flex items-center justify-center font-semibold shadow transition-all">
                                    <Plus size={20} className="mr-1"/> Adicionar
                                </button>
                            </div>
                        </div>
                        {productSpecialInputsForFicha.length > 0 && (
                            <div className="mt-6 border-t pt-6">
                                <h3 className="font-semibold text-slate-800 mb-4 flex items-center">
                                    <Calculator size={18} className="mr-2 text-primary-600"/> Simulador de Custo Final
                                </h3>
                                <div className="p-4 border border-primary-200 rounded-lg bg-primary-50/50 space-y-4 mb-4">
                                    {hasSizeSpecificQuantities && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tamanho para Simulação</label>
                                            <select
                                                value={simulationSize}
                                                onChange={e => setSimulationSize(e.target.value as any)}
                                                className="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500 text-sm"
                                            >
                                                <option value="geral">Padrão/Geral</option>
                                                <option value="infantil">Infantil</option>
                                                <option value="adulto">Adulto</option>
                                            </select>
                                        </div>
                                    )}
                                    {productSpecialInputsForFicha.map(si => (
                                        <div key={si.id}>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Escolha o {si.specialInput?.nome}
                                            </label>
                                            <select
                                                value={simulationSelections[si.insumo_especial_id!] || ''}
                                                onChange={e => setSimulationSelections(prev => ({ ...prev, [si.insumo_especial_id!]: parseInt(e.target.value)}))}
                                                className="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500 text-sm"
                                            >
                                                <option value="">Selecione uma opção...</option>
                                                {si.options.map(opt => <option key={opt.id} value={opt.id}>{opt.nome}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                
                                {costSimulation && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                        <MetricDisplay title="Custo Final Simulado" value={formatCurrency(costSimulation.totalSimulatedCost)} colorClass="text-danger-600"/>
                                        <MetricDisplay title={`Preço Final (${markupKey.replace('markup_', '').toUpperCase()})`} value={formatCurrency(costSimulation.simulatedPrice)} colorClass="text-success-600"/>
                                        <MetricDisplay title="Markup Final" value={`${costSimulation.simulatedMarkup.toFixed(2)}x`} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                 ) : (
                    <div className="mt-4 pt-4 border-t">
                        <EmptyState icon={<ChevronsRight size={40}/>} message="Nenhum produto selecionado" description="Selecione um produto na lista abaixo para ver ou editar sua ficha técnica."/>
                    </div>
                 )}
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                         <CardTitle>Lista de Produtos</CardTitle>
                         <select
                            value={markupKey}
                            onChange={(e) => setMarkupKey(e.target.value as any)}
                            className="w-full md:w-auto p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="markup_p1">Preço P1</option>
                            <option value="markup_p2">Preço P2</option>
                            <option value="markup_p3">Preço P3</option>
                        </select>
                    </div>
                </CardHeader>
                 <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Produto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Custo Base</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Markup</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Preço ({markupKey.replace('markup_', '').toUpperCase()})</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white divide-y divide-slate-100">
                            {produtosComPreco.map(produto => (
                                <tr 
                                    key={produto.id} 
                                    onClick={() => setSelectedProduto(produto)}
                                    className={`cursor-pointer hover:bg-slate-100 transition-colors ${selectedProduto?.id === produto.id ? 'bg-primary-50 hover:bg-primary-100' : ''}`}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{produto.nome}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-danger-600 font-semibold">{formatCurrency(produto.custo_calculado)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{produto.markup.toFixed(2)}x</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {selectedProduto?.id === produto.id ? (
                                            <div className="relative flex items-center">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editableProductPrice}
                                                    onChange={(e) => setEditableProductPrice(e.target.value)}
                                                    onBlur={handleUpdateProductPrice}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={isSavingPrice}
                                                    className="p-1.5 pl-8 border bg-white border-slate-300 rounded-md w-36 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-primary-500"
                                                />
                                                {produto.preco_venda_manual !== null && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleResetManualPrice();
                                                        }}
                                                        title="Voltar ao preço por markup"
                                                        className="ml-2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                                                        disabled={isSavingPrice}
                                                    >
                                                        <RefreshCcw size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className={`font-semibold ${produto.preco_venda_manual !== null ? 'text-brandBlue-600' : 'text-success-600'}`}>
                                                {formatCurrency(produto.precoVenda)}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </Card>

            {isCopyModalOpen && selectedProduto && (
                <CopyFichaModal
                    isOpen={isCopyModalOpen}
                    onClose={() => setIsCopyModalOpen(false)}
                    produtos={produtosBase}
                    sourceProduto={selectedProduto}
                    onConfirmCopy={handleConfirmCopy}
                />
            )}
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                initialType="fichas_tecnicas"
            />
        </div>
    );
};

export default FichasPanel;
