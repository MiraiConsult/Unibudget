import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
// FIX: Import `Json` type to resolve 'Cannot find name' error.
import type { ProdutoBase, Adicional, OrcamentoItem, OrcamentoItemAdicional, FichaTecnicaItem, Json } from '../types';
import { PlusCircle, Trash2, Minus, Plus, ShoppingCart, List, CheckCircle, ArrowLeft, ArrowRight, User, Tag, Edit3, Send, Info, Printer, Sparkles } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { useNotification } from '../contexts/NotificationContext';
import EmptyState from './ui/EmptyState';
import BudgetPreviewModal from './modals/BudgetPreviewModal';

interface SelectedAdicionalItem {
  id: string; 
  adicionalId: number | null;
  qty: number;
  price: number;
}

interface SimulationResults {
  custoUnitario: number;
  precoUnitario: number;
  lucroUnitario: number;
  custoTotal: number;
  receitaTotal: number;
  lucroTotal: number;
  markup: number;
  margemLucro: number;
}

const BudgetBuilder: React.FC = () => {
  const { 
    produtosBase, adicionais, vendedores, parametros, fichasTecnicas, insumosEspeciais, insumosEspeciaisOpcoes, insumos,
    currentOrcamento, setCurrentOrcamento, fetchData 
  } = useData();
  const { showNotification } = useNotification();
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const [step, setStep] = useState(1);
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  
  const [selectedProduto, setSelectedProduto] = useState<ProdutoBase | null>(null);
  const [selectedAdicionaisList, setSelectedAdicionaisList] = useState<SelectedAdicionalItem[]>([]);
  const [specialSelections, setSpecialSelections] = useState<Record<number, number>>({});
  const [simulationSize, setSimulationSize] = useState<'geral' | 'infantil' | 'adulto'>('geral');
  const [quantity, setQuantity] = useState(1);
  const [markupKey, setMarkupKey] = useState<'markup_p1' | 'markup_p2' | 'markup_p3'>('markup_p1');
  const [isSaving, setIsSaving] = useState(false);
  const [editablePrice, setEditablePrice] = useState<string>('');
  const [tablePrice, setTablePrice] = useState<number>(0);

  const [simulation, setSimulation] = useState<SimulationResults | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const editingItem = useMemo(() => 
    editingItemId ? currentOrcamento.itens.find(i => i.id === editingItemId) : null,
    [editingItemId, currentOrcamento.itens]
  );
  
  const productSpecialInputs = useMemo(() => {
    if (!selectedProduto) return [];
    
    return fichasTecnicas
      .filter(ft => ft.produto_base_id === selectedProduto.id && ft.insumo_especial_id)
      .map(ft => {
          const specialInput = insumosEspeciais.find(is => is.id === ft.insumo_especial_id);
          const options = insumosEspeciaisOpcoes
              .filter(opt => opt.insumo_especial_id === ft.insumo_especial_id)
              .map(opt => insumos.find(i => i.id === opt.insumo_id))
              .filter((i): i is typeof i & {} => !!i);
          return { ...ft, specialInput, options };
      })
      .filter(item => item.specialInput && item.options.length > 0);
  }, [selectedProduto, fichasTecnicas, insumosEspeciais, insumosEspeciaisOpcoes, insumos]);

  const hasSizeSpecificQuantities = useMemo(() => {
    if (!selectedProduto) return false;
    return productSpecialInputs.some(item => item.quantidade_adulto !== null || item.quantidade_infantil !== null);
  }, [selectedProduto, productSpecialInputs]);


  useEffect(() => {
    const fetchClients = async () => {
        if (currentOrcamento.nomeCliente.length > 2) {
            const { data, error } = await supabase
                .from('orcamentos')
                .select('nome_cliente')
                .ilike('nome_cliente', `%${currentOrcamento.nomeCliente}%`)
                .limit(5);
            if (!error && data) {
                if (Array.isArray(data)) {
                  const uniqueNames = [...new Set((data as { nome_cliente: string }[]).map((item) => item.nome_cliente))];
                  setClientSuggestions(uniqueNames);
                }
            }
        } else {
            setClientSuggestions([]);
        }
    };
    const debounce = setTimeout(fetchClients, 300);
    return () => clearTimeout(debounce);
  }, [currentOrcamento.nomeCliente]);

  const groupedAdicionais = useMemo(() => {
    return adicionais.reduce<Record<string, Adicional[]>>((acc, adicional) => {
      const key = adicional.tipo_adicional;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(adicional);
      return acc;
    }, {});
  }, [adicionais]);
  
  const selectedAdicionaisData = useMemo(() => {
    return selectedAdicionaisList
        .map((item) => {
            const adicional = adicionais.find(a => a.id === item.adicionalId);
            if (!adicional || item.qty <= 0) return null;
            return { adicional, qty: item.qty, price: item.price };
        })
        .filter((item): item is { adicional: Adicional; qty: number; price: number } => item !== null);
  }, [selectedAdicionaisList, adicionais]);

   const costOfSpecialInputs = useMemo(() => {
    return productSpecialInputs.reduce((totalCost, specialInput) => {
        const selectedOptionId = specialSelections[specialInput.insumo_especial_id!];
        if (!selectedOptionId) return totalCost;

        const selectedInsumo = insumos.find(i => i.id === selectedOptionId);
        if (!selectedInsumo) return totalCost;

        let quantityToUse = specialInput.quantidade;
        if (simulationSize === 'infantil' && specialInput.quantidade_infantil !== null) {
            quantityToUse = specialInput.quantidade_infantil;
        } else if (simulationSize === 'adulto' && specialInput.quantidade_adulto !== null) {
            quantityToUse = specialInput.quantidade_adulto;
        }

        if (quantityToUse === null) return totalCost;

        const cost = selectedInsumo.custo_unitario * quantityToUse;
        return totalCost + cost;
    }, 0);
  }, [productSpecialInputs, specialSelections, insumos, simulationSize]);

  useEffect(() => {
    if (!selectedProduto || !parametros) {
        setEditablePrice('');
        setTablePrice(0);
        return;
    }
    const custoAdicionais = selectedAdicionaisData.reduce((sum, { adicional, qty }) => sum + (adicional.custo_adicional * qty), 0);
    const precoAdicionais = selectedAdicionaisData.reduce((sum, { price, qty }) => sum + (price * qty), 0);

    const custoBase = selectedProduto.custo_calculado + costOfSpecialInputs;
    const precoBase = selectedProduto.preco_venda_manual ?? (custoBase * (parametros[markupKey] || 1));

    const precoTabelaTotal = precoBase + precoAdicionais;

    setTablePrice(precoTabelaTotal);
    if (!editingItemId) {
        setEditablePrice(precoTabelaTotal.toFixed(2));
    }
  }, [selectedProduto, selectedAdicionaisData, markupKey, parametros, editingItemId, costOfSpecialInputs]);

  useEffect(() => {
    if (!selectedProduto) {
      setSimulation(null);
      return;
    }

    const allSpecialInputsSelected = productSpecialInputs.every(si => !!specialSelections[si.insumo_especial_id!]);
    if (productSpecialInputs.length > 0 && !allSpecialInputsSelected) {
        setSimulation(null);
        return;
    }

    const custoAdicionais = selectedAdicionaisData.reduce((sum, { adicional, qty }) => sum + (adicional.custo_adicional * qty), 0);
    const custoUnitario = selectedProduto.custo_calculado + custoAdicionais + costOfSpecialInputs;
    
    const precoUnitario = parseFloat(editablePrice) || 0;
    const qtt = quantity > 0 ? quantity : 1;

    const lucroUnitario = precoUnitario - custoUnitario;
    const custoTotal = custoUnitario * qtt;
    const receitaTotal = precoUnitario * qtt;
    const lucroTotal = lucroUnitario * qtt;
    const markup = custoUnitario > 0 ? precoUnitario / custoUnitario : 0;
    const margemLucro = receitaTotal > 0 ? (lucroTotal / receitaTotal) * 100 : 0;
    
    setSimulation({
      custoUnitario, precoUnitario, lucroUnitario, custoTotal,
      receitaTotal, lucroTotal, markup, margemLucro
    });

  }, [selectedProduto, selectedAdicionaisData, quantity, editablePrice, costOfSpecialInputs, productSpecialInputs, specialSelections]);

  const resetSimulator = () => {
    setEditingItemId(null);
    setSelectedProduto(null);
    setSelectedAdicionaisList([]);
    setSpecialSelections({});
    setSimulationSize('geral');
    setQuantity(1);
    setEditablePrice('');
  };

  const handleAddAdicionalRow = () => {
    const newRow: SelectedAdicionalItem = {
        id: new Date().toISOString(),
        adicionalId: null,
        qty: 1,
        price: 0,
    };
    setSelectedAdicionaisList(prev => [...prev, newRow]);
  };

  const handleRemoveAdicionalRow = (id: string) => {
      setSelectedAdicionaisList(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateAdicionalRow = (id: string, updates: Partial<Omit<SelectedAdicionalItem, 'id'>>) => {
    setSelectedAdicionaisList(prev => 
        prev.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, ...updates };
                
                if ('adicionalId' in updates && updates.adicionalId !== item.adicionalId) {
                    const newAdicional = adicionais.find(a => a.id === updatedItem.adicionalId);
                    updatedItem.price = newAdicional?.preco_venda ?? 0;
                }
                return updatedItem;
            }
            return item;
        })
    );
  };

  const handleAddItem = () => {
    if (!selectedProduto || quantity <= 0 || !simulation) return;

    const adicionaisParaItem: OrcamentoItemAdicional[] = selectedAdicionaisData.map(({ adicional, qty, price }) => ({
        type: 'adicional',
        adicionalId: adicional.id,
        quantidade: qty,
        nome_opcao: adicional.nome_opcao,
        custo_adicional: adicional.custo_adicional,
        preco_venda: price,
    }));

    const newItem: OrcamentoItem = {
      id: new Date().toISOString(),
      produto: selectedProduto,
      adicionais: adicionaisParaItem as unknown as Json,
      specialSelections: specialSelections,
      tamanho: hasSizeSpecificQuantities ? simulationSize : null,
      quantidade: quantity,
      custoUnitario: simulation.custoUnitario,
      precoUnitario: simulation.precoUnitario,
      precoTabelaUnitario: tablePrice,
      markup: simulation.markup,
    };

    setCurrentOrcamento(prev => ({ ...prev, itens: [...prev.itens, newItem] }));
    showNotification(`"${newItem.produto.nome}" adicionado ao orçamento.`, 'success');
    resetSimulator();
  };

  const handleUpdateItem = () => {
    if (!editingItemId || !selectedProduto || !simulation) return;

    const adicionaisParaItem: OrcamentoItemAdicional[] = selectedAdicionaisData.map(({ adicional, qty, price }) => ({
        type: 'adicional',
        adicionalId: adicional.id,
        quantidade: qty,
        nome_opcao: adicional.nome_opcao,
        custo_adicional: adicional.custo_adicional,
        preco_venda: price,
    }));

    setCurrentOrcamento(prev => ({
        ...prev,
        itens: prev.itens.map(item => item.id === editingItemId ? {
            ...item,
            produto: selectedProduto,
            adicionais: adicionaisParaItem as unknown as Json,
            specialSelections: specialSelections,
            tamanho: hasSizeSpecificQuantities ? simulationSize : null,
            quantidade: quantity,
            custoUnitario: simulation.custoUnitario,
            precoUnitario: simulation.precoUnitario,
            precoTabelaUnitario: tablePrice,
            markup: simulation.markup,
        } : item)
    }));
    
    showNotification(`Item atualizado com sucesso.`, 'success');
    resetSimulator();
  };

  const handleEditItem = (item: OrcamentoItem) => {
    setEditingItemId(item.id);
    setSelectedProduto(item.produto);
    setSpecialSelections(item.specialSelections);
    setSimulationSize(item.tamanho || 'geral');
    
    let adicionaisToEdit: OrcamentoItemAdicional[] = [];
    const adicionaisRaw = item.adicionais;
    if (Array.isArray(adicionaisRaw)) {
        // FIX: Cast to `unknown` first to enable conversion between structurally incompatible types.
        adicionaisToEdit = adicionaisRaw as unknown as OrcamentoItemAdicional[];
    } else if (adicionaisRaw && typeof adicionaisRaw === 'object') {
        const payload = adicionaisRaw as { adicionais?: OrcamentoItemAdicional[] };
        if (payload.adicionais && Array.isArray(payload.adicionais)) {
            adicionaisToEdit = payload.adicionais;
        }
    }

    const newAdicionaisList = adicionaisToEdit.map((ad, index) => {
        return {
            id: `${ad.adicionalId}-${index}-${Date.now()}`,
            adicionalId: ad.adicionalId,
            qty: ad.quantidade,
            price: ad.preco_venda,
        };
    });
    setSelectedAdicionaisList(newAdicionaisList);

    setQuantity(item.quantidade);
    setEditablePrice(item.precoUnitario.toFixed(2));
    
    document.getElementById('simulator-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showNotification(`Editando "${item.produto.nome}".`, 'info');
  };
  
  const handleRemoveItem = (itemId: string) => {
    const itemToRemove = currentOrcamento.itens.find(item => item.id === itemId);
    setCurrentOrcamento(prev => ({
      ...prev,
      itens: prev.itens.filter(item => item.id !== itemId),
    }));
    if (itemToRemove) {
      showNotification(`"${itemToRemove.produto.nome}" removido do orçamento.`, 'danger');
    }
  };
  
  const handleSaveBudget = async () => {
    if (!currentOrcamento.nomeCliente || !currentOrcamento.vendedorId || currentOrcamento.itens.length === 0) {
        showNotification("Preencha o cliente, vendedor e adicione itens.", 'warning');
        return;
    }
    setIsSaving(true);
    
    const { totalReceita, totalCustoProducao, totalCustosVariaveis, totalLucro } = calculateTotals();

    try {
        const { data: orcamentoData, error: orcamentoError } = await supabase
            .from('orcamentos')
            .insert({
                nome_cliente: currentOrcamento.nomeCliente,
                vendedor_id: currentOrcamento.vendedorId!,
                total_receita: totalReceita,
                total_custo_producao: totalCustoProducao,
                total_custos_variaveis: totalCustosVariaveis,
                total_lucro: totalLucro,
            })
            .select()
            .single();

        if (orcamentoError) throw orcamentoError;
        if (!orcamentoData) throw new Error("Falha ao criar o orçamento.");
        
        const orcamentoItensToInsert = currentOrcamento.itens.map(item => ({
            orcamento_id: orcamentoData.id,
            produto_base_id: item.produto.id,
            adicionais: {
                adicionais: item.adicionais,
                specialSelections: item.specialSelections,
                tamanho: item.tamanho,
            } as unknown as Json,
            quantidade: item.quantidade,
            custo_unitario_calculado: item.custoUnitario,
            preco_unitario_praticado: item.precoUnitario,
        }));
        
        const { error: itensError } = await supabase.from('orcamento_itens').insert(orcamentoItensToInsert);
        if (itensError) throw itensError;

        showNotification('Orçamento salvo com sucesso!', 'success');
        setCurrentOrcamento({ id: null, nomeCliente: '', vendedorId: null, itens: [] });
        fetchData();
        setStep(1); 

    } catch (error: any) {
        console.error("Error saving budget:", error);
        showNotification(`Erro ao salvar: ${error.message}`, 'danger');
    } finally {
        setIsSaving(false);
    }
  };

  const calculateTotals = () => {
    const totalReceita = currentOrcamento.itens.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0);
    const totalCustoProducao = currentOrcamento.itens.reduce((sum, item) => sum + (item.custoUnitario * item.quantidade), 0);
    
    const taxaImposto = parametros?.taxa_imposto || 0;
    const taxaComissao = parametros?.taxa_comissao || 0;
    const taxaTotal = taxaImposto + taxaComissao;

    const totalCustosVariaveis = totalReceita * taxaTotal;
    const totalLucro = totalReceita - totalCustoProducao - totalCustosVariaveis;
    return { totalReceita, totalCustoProducao, totalCustosVariaveis, totalLucro };
  };

  const inputStyles = "w-full p-3 bg-slate-100 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all";
  const selectStyles = `${inputStyles} bg-white`;
  
  const MetricDisplay: React.FC<{ title: string; value: string; colorClass?: string; isLarge?: boolean }> = ({ title, value, colorClass = 'text-slate-800', isLarge = false }) => (
    <div className="bg-slate-50 p-3 rounded-lg text-center">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</p>
      <p className={`${isLarge ? 'text-2xl' : 'text-lg'} font-bold ${colorClass}`}>{value}</p>
    </div>
  );
  
  const steps = [
    { number: 1, title: 'Informações', icon: <User size={20}/> },
    { number: 2, title: 'Itens do Orçamento', icon: <List size={20}/> },
    { number: 3, title: 'Revisão', icon: <CheckCircle size={20}/> },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Criar Novo Orçamento</h1>
            <p className="text-slate-500 mt-1">Siga os passos para gerar uma nova proposta comercial.</p>
        </div>

        <div className="flex justify-center mb-8">
            <ol className="flex items-center w-full max-w-2xl">
                {steps.map((s, index) => (
                     <li key={s.number} className={`flex w-full items-center ${index < steps.length - 1 ? "after:content-[''] after:w-full after:h-1 after:border-b after:border-4 after:inline-block" : ""} ${step >= s.number ? 'text-primary-600 after:border-primary-600' : 'text-slate-400 after:border-slate-200'}`}>
                        <span className={`flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0 ${step >= s.number ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {s.icon}
                        </span>
                    </li>
                ))}
            </ol>
        </div>

        {step === 1 && (
            <Card className="max-w-3xl mx-auto animate-fade-in">
                <CardHeader><CardTitle>1. Informações do Orçamento</CardTitle></CardHeader>
                 <div className="space-y-6">
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Cliente</label>
                        <input type="text" placeholder="Digite para buscar ou adicionar um novo cliente" value={currentOrcamento.nomeCliente} onChange={(e) => {setCurrentOrcamento(prev => ({...prev, nomeCliente: e.target.value}));}} className={inputStyles}/>
                        {clientSuggestions.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border border-slate-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                                {clientSuggestions.map(name => (
                                    <li key={name} onClick={() => { setCurrentOrcamento(prev => ({...prev, nomeCliente: name})); setClientSuggestions([]); }} className="p-2 hover:bg-slate-100 cursor-pointer text-sm">
                                        {name}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-slate-700 mb-2">Vendedor Responsável</label>
                        <select value={currentOrcamento.vendedorId || ''} onChange={(e) => setCurrentOrcamento(prev => ({...prev, vendedorId: parseInt(String(e.target.value)) || null}))} className={selectStyles}>
                            <option value="">Selecione um Vendedor</option>
                            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                        </select>
                    </div>
                 </div>
                 <div className="mt-8 border-t pt-6 flex justify-end">
                    <button onClick={() => setStep(2)} disabled={!currentOrcamento.nomeCliente || !currentOrcamento.vendedorId} className="flex items-center justify-center px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg shadow-lg shadow-primary-500/30 hover:bg-primary-700 disabled:bg-slate-400 disabled:shadow-none disabled:cursor-not-allowed transition-all">
                        Avançar para Itens <ArrowRight size={18} className="ml-2"/>
                    </button>
                 </div>
            </Card>
        )}

        {step === 2 && (
             <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 animate-fade-in">
                <div className="lg:col-span-3 space-y-6">
                    <Card id="simulator-card">
                        <CardHeader>
                            <CardTitle>
                                {editingItem ? `Editando: ${editingItem.produto.nome}` : 'Simulador de Venda'}
                            </CardTitle>
                        </CardHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <select value={selectedProduto?.id || ''} onChange={(e) => { const p = produtosBase.find(p => p.id === parseInt(e.target.value)) || null; setSelectedProduto(p); setSpecialSelections({}) }} className={selectStyles}>
                                <option value="">Selecione um Produto para Simular</option>
                                {produtosBase.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                            <select value={markupKey} onChange={e => setMarkupKey(e.target.value as any)} className={selectStyles} disabled={!selectedProduto}>
                                <option value="markup_p1">Preço P1</option><option value="markup_p2">Preço P2</option><option value="markup_p3">Preço P3</option>
                            </select>
                        </div>
                        {selectedProduto && (
                            <div className="mt-6 space-y-4">
                                {hasSizeSpecificQuantities && (
                                    <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                            Tamanho (para cálculo de insumos)
                                        </label>
                                        <select
                                            value={simulationSize}
                                            onChange={e => setSimulationSize(e.target.value as any)}
                                            className={`${selectStyles} p-2 text-sm`}
                                        >
                                            <option value="geral">Padrão/Geral</option>
                                            <option value="infantil">Infantil</option>
                                            <option value="adulto">Adulto</option>
                                        </select>
                                    </div>
                                )}
                                {productSpecialInputs.length > 0 && (
                                     <div className="p-4 border border-primary-200 rounded-lg bg-primary-50/50 space-y-3">
                                        <h4 className="font-semibold text-primary-800 text-base mb-2 flex items-center"><Sparkles size={18} className="mr-2"/> Opções Especiais</h4>
                                        {productSpecialInputs.map(si => (
                                            <div key={si.id}>
                                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                  Escolha o {si.specialInput?.nome}
                                                </label>
                                                <select
                                                    value={specialSelections[si.insumo_especial_id!] || ''}
                                                    onChange={e => setSpecialSelections(prev => ({ ...prev, [si.insumo_especial_id!]: parseInt(e.target.value)}))}
                                                    className={`${selectStyles} p-2 text-sm`}
                                                >
                                                    <option value="">Selecione uma opção...</option>
                                                    {si.options.map(opt => <option key={opt.id} value={opt.id}>{opt.nome}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {Object.keys(groupedAdicionais).length > 0 ? (
                                    <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
                                        <h4 className="font-semibold text-slate-700 text-base mb-3">Adicionais</h4>
                                        {selectedAdicionaisList.length > 0 && (
                                            <div className="grid grid-cols-12 items-center gap-2 mb-2 px-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider col-span-5">Opção</label>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider col-span-3 text-center">Qtd.</label>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider col-span-3">Preço Unit.</label>
                                                <div className="col-span-1"></div>
                                            </div>
                                        )}
                                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                                            {selectedAdicionaisList.map(item => (
                                                <div key={item.id} className="grid grid-cols-12 items-center gap-2">
                                                    <select
                                                        value={item.adicionalId || ''}
                                                        onChange={e => handleUpdateAdicionalRow(item.id, { adicionalId: parseInt(e.target.value) || null })}
                                                        className="col-span-5 p-1.5 border bg-white border-slate-300 rounded-md w-full text-sm focus:ring-1 focus:ring-primary-500"
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {Object.entries(groupedAdicionais).map(([tipo, ads]) => (
                                                            <optgroup label={tipo} key={tipo}>
                                                                {ads.map(ad => <option key={ad.id} value={ad.id}>{ad.nome_opcao}</option>)}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    <div className="flex items-center justify-center col-span-3">
                                                        <button onClick={() => handleUpdateAdicionalRow(item.id, { qty: Math.max(0, item.qty - 1) })} className="p-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 focus:outline-none"><Minus size={14}/></button>
                                                        <input type="number" value={item.qty} onChange={e => handleUpdateAdicionalRow(item.id, { qty: parseInt(e.target.value) || 0 })} className="w-12 text-center mx-1 bg-transparent font-semibold text-slate-800 focus:outline-none"/>
                                                        <button onClick={() => handleUpdateAdicionalRow(item.id, { qty: item.qty + 1 })} className="p-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 focus:outline-none"><Plus size={14}/></button>
                                                    </div>
                                                    <div className="col-span-3 relative">
                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                                                        <input type="number" step="0.01" value={item.price} onChange={e => handleUpdateAdicionalRow(item.id, { price: parseFloat(e.target.value) || 0 })} className="p-1.5 pl-8 border bg-white border-slate-300 rounded-md w-full text-sm focus:ring-1 focus:ring-primary-500"/>
                                                    </div>
                                                    <div className="col-span-1 text-right">
                                                        <button onClick={() => handleRemoveAdicionalRow(item.id)} className="text-slate-400 hover:text-danger-600"><Trash2 size={16}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={handleAddAdicionalRow} className="mt-3 flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                                            <PlusCircle size={16} className="mr-2"/> Adicionar Opcional
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 px-2 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center">
                                        <Info size={16} className="text-slate-500 mr-2"/>
                                        <div>
                                            <p className="text-sm font-medium text-slate-600">Nenhum adicional disponível.</p>
                                            <p className="text-xs text-slate-500">Vá para 'Cadastros' para adicionar opções.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                         {selectedProduto && simulation && (
                            <div className="mt-6 border-t pt-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Quantidade</label>
                                        <div className="flex items-center">
                                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-2 border rounded-l-lg bg-slate-100 hover:bg-slate-200"><Minus size={16}/></button>
                                            <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className={`${inputStyles} rounded-none text-center font-bold text-lg w-20`}/>
                                            <button onClick={() => setQuantity(q => q + 1)} className="px-3 py-2 border rounded-r-lg bg-slate-100 hover:bg-slate-200"><Plus size={16}/></button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Preço Final Unitário</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                                            <input type="number" step="0.01" value={editablePrice} onChange={e => setEditablePrice(e.target.value)} className={`${inputStyles} pl-9 font-bold text-lg`} />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Tabela: {formatCurrency(tablePrice)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    <MetricDisplay title="Custo Unit." value={formatCurrency(simulation.custoUnitario)} colorClass="text-danger-600"/>
                                    <MetricDisplay title="Preço Unit." value={formatCurrency(simulation.precoUnitario)} />
                                    <MetricDisplay title="Markup" value={`${simulation.markup.toFixed(2)}x`} />
                                    <MetricDisplay title="Margem" value={`${simulation.margemLucro.toFixed(1)}%`} colorClass={simulation.margemLucro >= 0 ? 'text-success-600' : 'text-danger-600'}/>
                                </div>

                                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4">
                                    <h4 className="font-semibold text-slate-800 text-center mb-2">Resumo do Item (x{quantity})</h4>
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Custo Total</p>
                                            <p className="font-bold text-danger-600">{formatCurrency(simulation.custoTotal)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Receita Total</p>
                                            <p className="font-bold text-slate-800">{formatCurrency(simulation.receitaTotal)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Lucro Total</p>
                                            <p className="font-bold text-success-600">{formatCurrency(simulation.lucroTotal)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                         )}
                         <div className="mt-8 border-t pt-6">
                        {editingItem ? (
                            <div className="flex items-center space-x-4">
                                <button onClick={handleUpdateItem} disabled={!selectedProduto || !simulation} className="w-full flex items-center justify-center px-6 py-4 bg-success-600 text-white font-semibold rounded-lg shadow-lg shadow-success-500/30 hover:bg-success-700 disabled:bg-slate-400 disabled:shadow-none transition-all text-lg">
                                    <CheckCircle size={22} className="mr-2" /> Atualizar Item
                                </button>
                                 <button onClick={resetSimulator} className="w-full flex items-center justify-center px-6 py-4 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-all text-lg"> Cancelar </button>
                            </div>
                        ) : (
                            <button onClick={handleAddItem} disabled={!selectedProduto || !simulation} className="w-full flex items-center justify-center px-6 py-4 bg-primary-600 text-white font-semibold rounded-lg shadow-lg shadow-primary-500/30 hover:bg-primary-700 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none transition-all text-lg">
                                <PlusCircle size={22} className="mr-2" /> Adicionar Item
                            </button>
                        )}
                        </div>
                    </Card>
                </div>
                
                <div className="lg:col-span-2">
                    <Card className="h-full sticky top-8">
                        <CardHeader>
                            <div className="flex items-center">
                                <List size={20} className="mr-2 text-primary-600"/>
                                <CardTitle>Itens do Orçamento</CardTitle>
                            </div>
                        </CardHeader>
                        <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
                            {currentOrcamento.itens.length === 0 ? (
                                <EmptyState 
                                    icon={<ShoppingCart size={32}/>}
                                    message="Nenhum item no orçamento"
                                    description="Use o simulador para adicionar o primeiro item."
                                />
                            ) : (
                                currentOrcamento.itens.map(item => (
                                    <div key={item.id} className="p-3 border rounded-lg bg-white relative group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className="font-semibold text-slate-800">{item.produto.nome}</p>
                                                <p className="text-sm text-slate-500">Qtd: {item.quantidade} @ {formatCurrency(item.precoUnitario)}</p>
                                            </div>
                                            <p className="font-bold text-slate-900">{formatCurrency(item.quantidade * item.precoUnitario)}</p>
                                        </div>
                                        {item.tamanho && (
                                            <p className="text-xs text-slate-500 capitalize pl-1 mt-1">
                                                - Tamanho: <span className="font-medium text-slate-600">{item.tamanho === 'geral' ? 'Padrão' : item.tamanho}</span>
                                            </p>
                                        )}
                                        {(() => {
                                            // FIX: Resolve 'unknown' type error by properly checking and casting the 'item.adicionais' property.
                                            const adicionaisRaw = item.adicionais;
                                            let adicionaisList: OrcamentoItemAdicional[] = [];
                                        
                                            if (Array.isArray(adicionaisRaw)) {
                                                adicionaisList = adicionaisRaw as unknown as OrcamentoItemAdicional[];
                                            } else if (adicionaisRaw && typeof adicionaisRaw === 'object' && !Array.isArray(adicionaisRaw)) {
                                                // FIX: Correctly cast the 'adicionais' property from the JSON object.
                                                // By using a more specific type assertion, TypeScript can correctly infer the array type.
                                                const payload = adicionaisRaw as { adicionais?: OrcamentoItemAdicional[] };
                                                if (payload.adicionais && Array.isArray(payload.adicionais)) {
                                                    adicionaisList = payload.adicionais;
                                                }
                                            }
                                        
                                            if (adicionaisList.length > 0) {
                                                return (
                                                    <ul className="pl-1 mt-2 space-y-0.5 list-disc list-inside">
                                                        {adicionaisList.map((ad: OrcamentoItemAdicional) => (
                                                            <li key={ad.adicionalId} className="text-xs text-slate-500">
                                                            {ad.nome_opcao} (x{ad.quantidade})
                                                            </li>
                                                        ))}
                                                    </ul>
                                                );
                                            }
                                            return null;
                                        })()}
                                        {Object.keys(item.specialSelections).length > 0 && (
                                            <ul className="pl-1 mt-2 space-y-0.5 list-disc list-inside">
                                                {Object.entries(item.specialSelections).map(([specialId, selectedId]) => {
                                                    const specialInput = insumosEspeciais.find(i => i.id === parseInt(specialId));
                                                    const selectedInsumo = insumos.find(i => i.id === selectedId);
                                                    if (!specialInput || !selectedInsumo) return null;
                                                    return (
                                                        <li key={specialId} className="text-xs text-slate-500">
                                                            {specialInput.nome}: <span className="font-medium text-slate-600">{selectedInsumo.nome}</span>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        )}
                                        <div className="absolute top-2 right-2 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm p-1 rounded-md">
                                            <button onClick={() => handleEditItem(item)} title="Editar" className="text-slate-500 hover:text-primary-600"><Edit3 size={16} /></button>
                                            <button onClick={() => handleRemoveItem(item.id)} title="Remover" className="text-slate-500 hover:text-danger-600"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="mt-6 pt-4 border-t flex justify-between items-center">
                           <button onClick={() => setStep(1)} className="flex items-center justify-center px-6 py-3 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-all">
                                <ArrowLeft size={18} className="mr-2"/> Voltar
                            </button>
                             <button onClick={() => setStep(3)} disabled={currentOrcamento.itens.length === 0} className="flex items-center justify-center px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg shadow-lg shadow-primary-500/30 hover:bg-primary-700 disabled:bg-slate-400 disabled:shadow-none disabled:cursor-not-allowed transition-all">
                               Revisar <ArrowRight size={18} className="ml-2"/>
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        )}

        {step === 3 && (
            <Card className="max-w-4xl mx-auto animate-fade-in">
                <CardHeader><CardTitle>3. Revisão Final do Orçamento</CardTitle></CardHeader>
                <div className="space-y-4">
                    <div className="p-4 border rounded-lg grid grid-cols-2 gap-4 bg-slate-50">
                        <div><p className="text-sm text-slate-500">Cliente</p><p className="font-semibold text-slate-800 text-lg">{currentOrcamento.nomeCliente}</p></div>
                        <div><p className="text-sm text-slate-500">Vendedor</p><p className="font-semibold text-slate-800 text-lg">{vendedores.find(v => v.id === currentOrcamento.vendedorId)?.nome}</p></div>
                    </div>
                     <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="p-3 text-left font-semibold text-slate-600">Produto</th>
                                    <th className="p-3 text-center font-semibold text-slate-600">Qtd</th>
                                    <th className="p-3 text-right font-semibold text-slate-600">Preço Unit.</th>
                                    <th className="p-3 text-right font-semibold text-slate-600">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentOrcamento.itens.map(item => (
                                    <tr key={item.id}>
                                        <td className="p-3 align-top">
                                            <p className="font-medium text-slate-800">{item.produto.nome}</p>
                                            {item.tamanho && (
                                                <p className="text-xs text-slate-500 capitalize pt-1">
                                                    (Tamanho: {item.tamanho === 'geral' ? 'Padrão' : item.tamanho})
                                                </p>
                                            )}
                                            {(() => {
// FIX: Resolve 'unknown' type error by properly checking and casting the 'item.adicionais' property.
                                                let adicionaisList: OrcamentoItemAdicional[] = [];
                                                const adicionaisRaw = item.adicionais;
                                                if (Array.isArray(adicionaisRaw)) {
                                                    adicionaisList = adicionaisRaw as unknown as OrcamentoItemAdicional[];
                                                } else if (adicionaisRaw && typeof adicionaisRaw === 'object' && !Array.isArray(adicionaisRaw)) {
                                                    const payload = adicionaisRaw as { adicionais?: OrcamentoItemAdicional[] };
                                                    if (payload.adicionais && Array.isArray(payload.adicionais)) {
                                                        adicionaisList = payload.adicionais;
                                                    }
                                                }
                                            
                                                if (adicionaisList.length > 0) {
                                                    return (
                                                        <ul className="pl-1 mt-1 space-y-0.5 list-disc list-inside">
                                                            {adicionaisList.map((ad: OrcamentoItemAdicional) => (
                                                                <li key={ad.adicionalId} className="text-xs text-slate-500">
                                                                    {ad.nome_opcao} (x{ad.quantidade})
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            {Object.keys(item.specialSelections).length > 0 && (
                                                <ul className="pl-1 mt-1 space-y-0.5 list-disc list-inside">
                                                    {Object.entries(item.specialSelections).map(([specialId, selectedId]) => {
                                                        const specialInput = insumosEspeciais.find(i => i.id === parseInt(specialId));
                                                        const selectedInsumo = insumos.find(i => i.id === selectedId);
                                                        if (!specialInput || !selectedInsumo) return null;
                                                        return (
                                                            <li key={specialId} className="text-xs text-slate-500">
                                                                {specialInput.nome}: <span className="font-medium text-slate-600">{selectedInsumo.nome}</span>
                                                            </li>
                                                        )
                                                    })}
                                                </ul>
                                            )}
                                        </td>
                                        <td className="p-3 text-center align-top">{item.quantidade}</td>
                                        <td className="p-3 text-right align-top">{formatCurrency(item.precoUnitario)}</td>
                                        <td className="p-3 text-right align-top font-semibold">{formatCurrency(item.precoUnitario * item.quantidade)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div className="mt-8 pt-6 border-t flex justify-between items-center">
                    <button onClick={() => setStep(2)} className="flex items-center justify-center px-6 py-3 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-all">
                        <ArrowLeft size={18} className="mr-2"/> Editar Itens
                    </button>
                    <div className="flex items-center space-x-4">
                        <button onClick={() => setIsPreviewModalOpen(true)} className="flex items-center justify-center px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-all">
                            <Printer size={18} className="mr-2"/> Visualizar / Imprimir
                        </button>
                        <button onClick={handleSaveBudget} disabled={isSaving} className="flex items-center justify-center px-8 py-4 bg-success-600 text-white font-bold rounded-lg shadow-lg shadow-success-500/30 hover:bg-success-700 disabled:bg-slate-400 disabled:shadow-none transition-all text-lg">
                           {isSaving ? 'Salvando...' : <><Send size={20} className="mr-2"/> Salvar e Concluir Orçamento</>}
                        </button>
                    </div>
                </div>
            </Card>
        )}

        {isPreviewModalOpen && (
            <BudgetPreviewModal 
                orcamento={currentOrcamento}
                vendedores={vendedores}
                onClose={() => setIsPreviewModalOpen(false)}
            />
        )}
    </div>
  );
};

export default BudgetBuilder;