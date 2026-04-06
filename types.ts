export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      adicionais: {
        Row: {
          id: number
          tipo_adicional: string
          nome_opcao: string
          custo_adicional: number
          preco_venda: number | null
        }
        Insert: {
          id?: number
          tipo_adicional: string
          nome_opcao: string
          custo_adicional: number
          preco_venda?: number | null
        }
        Update: {
          id?: number
          tipo_adicional?: string
          nome_opcao?: string
          custo_adicional?: number
          preco_venda?: number | null
        }
        Relationships: []
      }
      insumos: {
        Row: {
          id: number
          nome: string
          unidade_medida: string
          custo_unitario: number
        }
        Insert: {
          id?: number
          nome: string
          unidade_medida: string
          custo_unitario: number
        }
        Update: {
          id?: number
          nome?: string
          unidade_medida?: string
          custo_unitario?: number
        }
        Relationships: []
      }
      insumos_especiais: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      insumos_especiais_opcoes: {
        Row: {
          id: number
          insumo_especial_id: number
          insumo_id: number
        }
        Insert: {
          id?: number
          insumo_especial_id: number
          insumo_id: number
        }
        Update: {
          id?: number
          insumo_especial_id?: number
          insumo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "insumos_especiais_opcoes_insumo_especial_id_fkey"
            columns: ["insumo_especial_id"]
            isOneToOne: false
            referencedRelation: "insumos_especiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_especiais_opcoes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          }
        ]
      }
      produtos_base: {
        Row: {
          id: number
          nome: string
          custo_calculado: number
          preco_venda_manual: number | null
        }
        Insert: {
          id?: number
          nome: string
          custo_calculado?: number
          preco_venda_manual?: number | null
        }
        Update: {
          id?: number
          nome?: string
          custo_calculado?: number
          preco_venda_manual?: number | null
        }
        Relationships: []
      }
      fichas_tecnicas: {
        Row: {
          id: number
          produto_base_id: number
          insumo_id: number | null
          insumo_especial_id: number | null
          quantidade: number | null
          quantidade_adulto: number | null
          quantidade_infantil: number | null
        }
        Insert: {
          id?: number
          produto_base_id: number
          insumo_id?: number | null
          insumo_especial_id?: number | null
          quantidade?: number | null
          quantidade_adulto?: number | null
          quantidade_infantil?: number | null
        }
        Update: {
          id?: number
          produto_base_id?: number
          insumo_id?: number | null
          insumo_especial_id?: number | null
          quantidade?: number | null
          quantidade_adulto?: number | null
          quantidade_infantil?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fichas_tecnicas_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichas_tecnicas_insumo_especial_id_fkey"
            columns: ["insumo_especial_id"]
            isOneToOne: false
            referencedRelation: "insumos_especiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichas_tecnicas_produto_base_id_fkey"
            columns: ["produto_base_id"]
            isOneToOne: false
            referencedRelation: "produtos_base"
            referencedColumns: ["id"]
          }
        ]
      }
      vendedores: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      parametros_globais: {
        Row: {
          id: number
          markup_p1: number
          markup_p2: number
          markup_p3: number
          taxa_imposto: number
          taxa_comissao: number
        }
        Insert: {
          id?: number
          markup_p1?: number
          markup_p2?: number
          markup_p3?: number
          taxa_imposto?: number
          taxa_comissao?: number
        }
        Update: {
          id?: number
          markup_p1?: number
          markup_p2?: number
          markup_p3?: number
          taxa_imposto?: number
          taxa_comissao?: number
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          id: number
          created_at: string
          nome_cliente: string
          vendedor_id: number
          total_receita: number
          total_custo_producao: number
          total_custos_variaveis: number
          total_lucro: number
          status?: string
        }
        Insert: {
          id?: number
          created_at?: string
          nome_cliente: string
          vendedor_id: number
          total_receita?: number
          total_custo_producao?: number
          total_custos_variaveis?: number
          total_lucro?: number
          status?: string
        }
        Update: {
          id?: number
          created_at?: string
          nome_cliente?: string
          vendedor_id?: number
          total_receita?: number
          total_custo_producao?: number
          total_custos_variaveis?: number
          total_lucro?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          }
        ]
      }
      orcamento_itens: {
        Row: {
          id: number
          orcamento_id: number
          produto_base_id: number
          adicionais: Json | null
          quantidade: number
          custo_unitario_calculado: number
          preco_unitario_praticado: number
        }
        Insert: {
          id?: number
          orcamento_id: number
          produto_base_id: number
          adicionais?: Json | null
          quantidade: number
          custo_unitario_calculado: number
          preco_unitario_praticado: number
        }
        Update: {
          id?: number
          orcamento_id?: number
          produto_base_id?: number
          adicionais?: Json | null
          quantidade?: number
          custo_unitario_calculado?: number
          preco_unitario_praticado?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_base_id_fkey"
            columns: ["produto_base_id"]
            isOneToOne: false
            referencedRelation: "produtos_base"
            referencedColumns: ["id"]
          }
        ]
      }
      compras: {
        Row: {
          id: number
          created_at: string
          data_compra: string
          fornecedor: string
          insumo_id: number
          quantidade: number
          preco_unitario: number
          valor_total: number
        }
        Insert: {
          id?: number
          created_at?: string
          data_compra: string
          fornecedor: string
          insumo_id: number
          quantidade: number
          preco_unitario: number
          valor_total: number
        }
        Update: {
          id?: number
          created_at?: string
          data_compra?: string
          fornecedor?: string
          insumo_id?: number
          quantidade?: number
          preco_unitario?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          }
        ]
      }
      consumo_estoque: {
        Row: {
          id: number
          created_at: string
          data_consumo: string
          insumo_id: number
          quantidade: number
          motivo: string | null
          responsavel: string | null
          funcionario_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          data_consumo: string
          insumo_id: number
          quantidade: number
          motivo?: string | null
          responsavel?: string | null
          funcionario_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          data_consumo?: string
          insumo_id?: number
          quantidade?: number
          motivo?: string | null
          responsavel?: string | null
          funcionario_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consumo_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_estoque_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          }
        ]
      }
      funcionarios: {
        Row: {
          id: number
          created_at: string
          nome: string
          codigo_acesso: string
          setor: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          nome: string
          codigo_acesso: string
          setor?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          nome?: string
          codigo_acesso?: string
          setor?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_ficha_tecnica_quantities: {
        Args: {
          p_id: number;
          p_quantidade?: number | null;
          p_quantidade_adulto?: number | null;
          p_quantidade_infantil?: number | null;
        };
        Returns: undefined;
      };
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Custom types for app logic
export type Insumo = Database['public']['Tables']['insumos']['Row'];
export type InsumoEspecial = Database['public']['Tables']['insumos_especiais']['Row'];
export type InsumoEspecialOpcao = Database['public']['Tables']['insumos_especiais_opcoes']['Row'];
export type ProdutoBase = Database['public']['Tables']['produtos_base']['Row'];
export type FichaTecnica = Database['public']['Tables']['fichas_tecnicas']['Row'];
export type Adicional = Database['public']['Tables']['adicionais']['Row'];
export type Vendedor = Database['public']['Tables']['vendedores']['Row'];
export type ParametrosGlobais = Database['public']['Tables']['parametros_globais']['Row'];
export type Orcamento = Database['public']['Tables']['orcamentos']['Row'];
export type OrcamentoItemDB = Database['public']['Tables']['orcamento_itens']['Row'];
export type Compra = Database['public']['Tables']['compras']['Row'];
export type Consumo = Database['public']['Tables']['consumo_estoque']['Row'];
export type Funcionario = Database['public']['Tables']['funcionarios']['Row'];

export interface FichaTecnicaItem extends FichaTecnica {
  insumos: Insumo | null;
  insumos_especiais: InsumoEspecial | null;
}

export interface OrcamentoItemAdicional {
  type: 'adicional';
  adicionalId: number;
  quantidade: number;
  nome_opcao: string;
  custo_adicional: number;
  preco_venda: number;
}

export interface OrcamentoItemSpecialSelection {
    type: 'special_input';
    specialInputId: number; // ID do Insumo Especial (placeholder)
    selectedInsumoId: number; // ID do Insumo real escolhido
    specialInputName: string;
    selectedInsumoName: string;
    quantidade: number; // Da ficha técnica
    custo: number; // Custo calculado (qtd * custo_unit do insumo real)
}

export interface OrcamentoItem {
    id: string; // Temporary client-side ID
    produto: ProdutoBase;
    // FIX: Update type to reflect that `adicionais` can be a complex object from the DB or an array for new items.
    adicionais: Json | null;
    specialSelections: Record<number, number>; // insumo_especial_id -> selected_insumo_id
    tamanho?: 'infantil' | 'adulto' | 'geral' | null;
    quantidade: number;
    custoUnitario: number;
    precoUnitario: number;
    precoTabelaUnitario: number;
    markup: number;
}

export interface CurrentOrcamento {
    id: number | null; // DB id of existing budget
    nomeCliente: string;
    vendedorId: number | null;
    itens: OrcamentoItem[];
}

export type View = 'dashboard' | 'builder' | 'saved' | 'fichas' | 'admin' | 'settings' | 'help' | 'cost_analysis' | 'inventory' | 'purchases' | 'pedidos_externos';

export interface PedidoExterno {
    id: number;
    pedido_id_externo: string;
    codigo_pedido: string;
    data_pedido: string;
    status_cod: string;
    status_desc: string;
    valor_total: number;
    customer_name: string;
    seller_name: string;
    processado: boolean;
    tenant_id: string;
    payload_raw: Json;
    orcamento_id: number | null;
}

export interface PedidoLayoutExterno {
    id: number;
    pedido_externo_id: number;
    product_name: string;
    category: string;
    tissue: string;
    production: string;
    kit_product: string;
    produto_base_id: number | null;
    mapeamento_status: string;
    tenant_id: string;
}

export interface PedidoItemExterno {
    id: number;
    layout_externo_id: number;
    grid: string;
    size: string;
    qty: number;
    tenant_id: string;
}

export interface ProdutoExternoMapa {
    id: number;
    nome_externo: string;
    produto_base_id: number;
    tenant_id: string;
    ativo: boolean;
}