import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Insumo, ProdutoBase, FichaTecnica, Adicional, Vendedor, ParametrosGlobais, CurrentOrcamento, InsumoEspecial, InsumoEspecialOpcao, Compra, Consumo, Funcionario } from '../types';

interface DataContextType {
  insumos: Insumo[];
  insumosEspeciais: InsumoEspecial[];
  insumosEspeciaisOpcoes: InsumoEspecialOpcao[];
  produtosBase: ProdutoBase[];
  fichasTecnicas: FichaTecnica[];
  adicionais: Adicional[];
  vendedores: Vendedor[];
  funcionarios: Funcionario[];
  parametros: ParametrosGlobais | null;
  compras: Compra[];
  consumos: Consumo[];
  loading: boolean;
  currentOrcamento: CurrentOrcamento;
  setCurrentOrcamento: React.Dispatch<React.SetStateAction<CurrentOrcamento>>;
  fetchData: () => Promise<void>;
  recalculateProdutoCost: (produtoId: number) => Promise<void>;
  addCompra: (compra: Omit<Compra, 'id' | 'created_at'>) => Promise<boolean>;
  deleteCompra: (id: number) => Promise<boolean>;
  addConsumo: (consumo: Omit<Consumo, 'id' | 'created_at'>) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosEspeciais, setInsumosEspeciais] = useState<InsumoEspecial[]>([]);
  const [insumosEspeciaisOpcoes, setInsumosEspeciaisOpcoes] = useState<InsumoEspecialOpcao[]>([]);
  const [produtosBase, setProdutosBase] = useState<ProdutoBase[]>([]);
  const [fichasTecnicas, setFichasTecnicas] = useState<FichaTecnica[]>([]);
  const [adicionais, setAdicionais] = useState<Adicional[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [parametros, setParametros] = useState<ParametrosGlobais | null>(null);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [loading, setLoading] = useState(true);

  const initialOrcamentoState: CurrentOrcamento = {
    id: null,
    nomeCliente: '',
    vendedorId: null,
    itens: [],
  };
  const [currentOrcamento, setCurrentOrcamento] = useState<CurrentOrcamento>(initialOrcamentoState);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: insumosData },
        { data: insumosEspeciaisData },
        { data: insumosEspeciaisOpcoesData },
        { data: produtosBaseData },
        { data: fichasTecnicasData },
        { data: adicionaisData },
        { data: vendedoresData },
        { data: funcionariosData, error: funcionariosError },
        { data: parametrosData },
        { data: comprasData, error: comprasError },
        { data: consumosData, error: consumosError },
      ] = await Promise.all([
        supabase.from('insumos').select('*').order('nome'),
        supabase.from('insumos_especiais').select('*').order('nome'),
        supabase.from('insumos_especiais_opcoes').select('*'),
        supabase.from('produtos_base').select('*').order('nome'),
        supabase.from('fichas_tecnicas').select('*'),
        supabase.from('adicionais').select('*').order('tipo_adicional'),
        supabase.from('vendedores').select('*').order('nome'),
        supabase.from('funcionarios').select('*').order('nome'),
        supabase.from('parametros_globais').select('*').limit(1).single(),
        supabase.from('compras').select('*').order('data_compra', { ascending: false }),
        supabase.from('consumo_estoque').select('*').order('data_consumo', { ascending: false }),
      ]);

      setInsumos(insumosData || []);
      setInsumosEspeciais(insumosEspeciaisData || []);
      setInsumosEspeciaisOpcoes(insumosEspeciaisOpcoesData || []);
      setProdutosBase(produtosBaseData || []);
      setFichasTecnicas(fichasTecnicasData || []);
      setAdicionais(adicionaisData || []);
      setVendedores(vendedoresData || []);
      
      let finalFuncionarios = funcionariosData;
      if (funcionariosError) {
          console.warn("Tabela funcionarios não encontrada ou erro, usando localStorage como fallback", funcionariosError);
          const local = localStorage.getItem('unibudget_funcionarios');
          finalFuncionarios = local ? JSON.parse(local) : [];
      }
      setFuncionarios(finalFuncionarios || []);

      setParametros(parametrosData || null);

      let finalCompras = comprasData;
      if (comprasError) {
         console.warn("Tabela compras não encontrada ou erro, usando localStorage como fallback", comprasError);
         const local = localStorage.getItem('unibudget_compras');
         finalCompras = local ? JSON.parse(local) : [];
      }
      setCompras(finalCompras || []);

      let finalConsumos = consumosData;
      if (consumosError) {
         console.warn("Tabela consumo_estoque não encontrada ou erro, usando localStorage como fallback", consumosError);
         const local = localStorage.getItem('unibudget_consumos');
         finalConsumos = local ? JSON.parse(local) : [];
      }
      setConsumos(finalConsumos || []);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const recalculateProdutoCost = useCallback(async (produtoId: number) => {
    const { data: fichas, error: fichasError } = await supabase
      .from('fichas_tecnicas')
      .select('*, insumos(*)')
      .eq('produto_base_id', produtoId);

    if (fichasError || !fichas) {
      console.error("Error fetching ficha tecnica for cost calculation:", fichasError);
      return;
    }
    
    // Calculate base cost only from regular insumos
    const calculatedCost = fichas.reduce((acc, item) => {
        // Only sum if it's a regular insumo (insumo_id is not null)
        if (item.insumo_id && item.insumos) {
          return acc + (item.quantidade * (item.insumos.custo_unitario || 0));
        }
        return acc;
    }, 0);

    const { error: updateError } = await supabase
      .from('produtos_base')
      .update({ custo_calculado: calculatedCost })
      .eq('id', produtoId);

    if (updateError) {
      console.error("Error updating product cost:", updateError);
    } else {
      await fetchData();
    }
  }, [fetchData]);

  const addCompra = async (compra: Omit<Compra, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('compras').insert(compra).select().single();
    if (error) {
        console.warn("Erro ao inserir compra no Supabase, usando localStorage", error);
        const local = localStorage.getItem('unibudget_compras');
        const localCompras = local ? JSON.parse(local) : [];
        const newCompra: Compra = { ...compra, id: Date.now(), created_at: new Date().toISOString() };
        const updatedCompras = [newCompra, ...localCompras];
        localStorage.setItem('unibudget_compras', JSON.stringify(updatedCompras));
        setCompras(updatedCompras);
        return true;
    } else {
        setCompras([data, ...compras]);
        return true;
    }
  };

  const deleteCompra = async (id: number) => {
    const { error } = await supabase.from('compras').delete().eq('id', id);
    if (error) {
        console.warn("Erro ao deletar compra no Supabase, usando localStorage", error);
        const local = localStorage.getItem('unibudget_compras');
        if (local) {
            const localCompras = JSON.parse(local);
            const updatedCompras = localCompras.filter((c: Compra) => c.id !== id);
            localStorage.setItem('unibudget_compras', JSON.stringify(updatedCompras));
            setCompras(updatedCompras);
        }
        return true;
    } else {
        setCompras(compras.filter(c => c.id !== id));
        return true;
    }
  };

  const addConsumo = async (consumo: Omit<Consumo, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('consumo_estoque').insert(consumo).select().single();
    if (error) {
        console.warn("Erro ao inserir consumo no Supabase, usando localStorage", error);
        const local = localStorage.getItem('unibudget_consumos');
        const localConsumos = local ? JSON.parse(local) : [];
        const newConsumo: Consumo = { ...consumo, id: Date.now(), created_at: new Date().toISOString() };
        const updatedConsumos = [newConsumo, ...localConsumos];
        localStorage.setItem('unibudget_consumos', JSON.stringify(updatedConsumos));
        setConsumos(updatedConsumos);
        return true;
    } else {
        setConsumos([data, ...consumos]);
        return true;
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DataContext.Provider value={{
      insumos,
      insumosEspeciais,
      insumosEspeciaisOpcoes,
      produtosBase,
      fichasTecnicas,
      adicionais,
      vendedores,
      funcionarios,
      parametros,
      compras,
      consumos,
      loading,
      currentOrcamento,
      setCurrentOrcamento,
      fetchData,
      recalculateProdutoCost,
      addCompra,
      deleteCompra,
      addConsumo,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};