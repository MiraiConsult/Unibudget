-- Tabelas novas (criadas para integração):
CREATE TABLE IF NOT EXISTS public.pedidos_externos (
    id bigserial PRIMARY KEY,
    pedido_id_externo text,
    codigo_pedido text,
    data_pedido date,
    status_cod text,
    status_desc text,
    valor_total numeric,
    customer_name text,
    seller_name text,
    processado boolean DEFAULT false,
    tenant_id uuid,
    payload_raw jsonb,
    orcamento_id bigint
);

CREATE TABLE IF NOT EXISTS public.pedido_layouts_externos (
    id bigserial PRIMARY KEY,
    pedido_externo_id bigint REFERENCES public.pedidos_externos(id) ON DELETE CASCADE,
    product_name text,
    category text,
    tissue text,
    production text,
    kit_product text,
    produto_base_id bigint,
    mapeamento_status text,
    tenant_id uuid
);

CREATE TABLE IF NOT EXISTS public.pedido_itens_externos (
    id bigserial PRIMARY KEY,
    layout_externo_id bigint REFERENCES public.pedido_layouts_externos(id) ON DELETE CASCADE,
    grid text,
    size text,
    qty int,
    tenant_id uuid
);

CREATE TABLE IF NOT EXISTS public.produto_externo_mapa (
    id bigserial PRIMARY KEY,
    nome_externo text,
    produto_base_id bigint,
    tenant_id uuid,
    ativo boolean DEFAULT true
);

-- Adicionar coluna orcamento_id caso a tabela já existisse
ALTER TABLE public.pedidos_externos ADD COLUMN IF NOT EXISTS orcamento_id bigint;

-- Adicionar FK do pedido para o orçamento gerado
ALTER TABLE public.pedidos_externos DROP CONSTRAINT IF EXISTS pedidos_externos_orcamento_id_fkey;
ALTER TABLE public.pedidos_externos ADD CONSTRAINT pedidos_externos_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES public.orcamentos(id) ON DELETE SET NULL;

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'manual';

-- Habilitar RLS
ALTER TABLE public.pedidos_externos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_layouts_externos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens_externos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_externo_mapa ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.pedidos_externos;
CREATE POLICY "Enable access for authenticated users" ON public.pedidos_externos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.pedido_layouts_externos;
CREATE POLICY "Enable access for authenticated users" ON public.pedido_layouts_externos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.pedido_itens_externos;
CREATE POLICY "Enable access for authenticated users" ON public.pedido_itens_externos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.produto_externo_mapa;
CREATE POLICY "Enable access for authenticated users" ON public.produto_externo_mapa FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Função PL/pgSQL
CREATE OR REPLACE FUNCTION public.criar_orcamento_do_pedido(p_pedido_externo_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pedido RECORD;
    v_layout RECORD;
    v_vendedor_id INT;
    v_vendedor_criado BOOLEAN := false;
    v_produto_base_id BIGINT;
    v_produtos_criados TEXT[] := '{}';
    v_orcamento_id BIGINT;
    v_tenant_id UUID;
    v_total_qty INT;
    v_tamanho TEXT;
    v_custo_calculado NUMERIC;
    v_adicionais JSONB;
    v_item RECORD;
    v_sizes JSONB;
BEGIN
    -- Busca o pedido
    SELECT * INTO v_pedido FROM public.pedidos_externos WHERE id = p_pedido_externo_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Pedido não encontrado');
    END IF;

    IF v_pedido.processado THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Pedido já processado');
    END IF;

    v_tenant_id := v_pedido.tenant_id;

    -- Passo 1: Resolve o vendedor
    SELECT id INTO v_vendedor_id FROM public.vendedores 
    WHERE TRIM(nome) ILIKE TRIM(v_pedido.seller_name) AND (tenant_id = v_tenant_id OR tenant_id IS NULL) LIMIT 1;

    IF v_vendedor_id IS NULL THEN
        INSERT INTO public.vendedores (nome, tenant_id) 
        VALUES (TRIM(v_pedido.seller_name), v_tenant_id) 
        RETURNING id INTO v_vendedor_id;
        v_vendedor_criado := true;
    END IF;

    -- Passo 3: Cria o orçamento (antes dos itens)
    INSERT INTO public.orcamentos (
        nome_cliente, vendedor_id, 
        total_receita, total_custo_producao, total_custos_variaveis, total_lucro,
        status, tenant_id
    ) VALUES (
        v_pedido.customer_name, v_vendedor_id,
        v_pedido.valor_total, 0, 0, 0,
        'pedido_externo', v_tenant_id
    ) RETURNING id INTO v_orcamento_id;

    -- Passo 2 e 4: Resolve os produtos e cria os itens do orçamento
    FOR v_layout IN SELECT * FROM public.pedido_layouts_externos WHERE pedido_externo_id = p_pedido_externo_id LOOP
        
        -- Resolve produto_base_id
        SELECT produto_base_id INTO v_produto_base_id FROM public.produto_externo_mapa 
        WHERE TRIM(nome_externo) ILIKE TRIM(v_layout.product_name) AND (tenant_id = v_tenant_id OR tenant_id IS NULL) LIMIT 1;

        IF v_produto_base_id IS NULL THEN
            INSERT INTO public.produtos_base (nome, custo_calculado, tenant_id) 
            VALUES (TRIM(v_layout.product_name), 0, v_tenant_id) 
            RETURNING id INTO v_produto_base_id;
            
            INSERT INTO public.produto_externo_mapa (nome_externo, produto_base_id, tenant_id)
            VALUES (TRIM(v_layout.product_name), v_produto_base_id, v_tenant_id);
            
            v_produtos_criados := array_append(v_produtos_criados, v_layout.product_name);
        END IF;

        -- Atualiza o layout com o produto resolvido
        UPDATE public.pedido_layouts_externos SET produto_base_id = v_produto_base_id WHERE id = v_layout.id;

        -- Calcula a quantidade total do layout e agrupa os tamanhos
        SELECT COALESCE(SUM(qty), 0) INTO v_total_qty FROM public.pedido_itens_externos WHERE layout_externo_id = v_layout.id;
        
        SELECT jsonb_object_agg(size, qty) INTO v_sizes FROM (
            SELECT size, SUM(qty) as qty FROM public.pedido_itens_externos WHERE layout_externo_id = v_layout.id GROUP BY size
        ) sub;

        -- Determina o tamanho (infantil se for numérico)
        -- Pega o primeiro size para determinar, ou varre todos. Vamos simplificar pegando o primeiro.
        SELECT size INTO v_tamanho FROM public.pedido_itens_externos WHERE layout_externo_id = v_layout.id LIMIT 1;
        IF v_tamanho ~ '^[0-9]+$' THEN
            v_tamanho := 'infantil';
        ELSE
            v_tamanho := 'adulto';
        END IF;

        -- Busca o custo calculado do produto
        SELECT custo_calculado INTO v_custo_calculado FROM public.produtos_base WHERE id = v_produto_base_id;

        -- Monta adicionais
        v_adicionais := jsonb_build_object(
            'tissue', v_layout.tissue,
            'production', v_layout.production,
            'kitProduct', v_layout.kit_product,
            'sizes', v_sizes,
            'tamanho_tipo', v_tamanho
        );

        -- Insere o item do orçamento
        IF v_total_qty > 0 THEN
            INSERT INTO public.orcamento_itens (
                orcamento_id, produto_base_id, quantidade, 
                custo_unitario_calculado, preco_unitario_praticado, adicionais, tenant_id
            ) VALUES (
                v_orcamento_id, v_produto_base_id, v_total_qty, 
                COALESCE(v_custo_calculado, 0), 0, v_adicionais, v_tenant_id
            );
        END IF;

    END LOOP;

    -- Passo 5: Finaliza
    UPDATE public.pedidos_externos 
    SET processado = true, orcamento_id = v_orcamento_id 
    WHERE id = p_pedido_externo_id;

    RETURN jsonb_build_object(
        'sucesso', true, 
        'orcamento_id', v_orcamento_id, 
        'vendedor_criado', v_vendedor_criado, 
        'produtos_criados', v_produtos_criados
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', SQLERRM);
END;
$$;
