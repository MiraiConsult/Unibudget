-- =================================================================
-- MIGRAÇÃO: ISOLAMENTO MULTI-TENANT (corrige vazamento de dados
-- entre empresas — ex.: tecidos/insumos especiais aparecendo em
-- outros tenants).
--
-- Execute este script INTEIRO no SQL Editor do Supabase, de uma
-- única vez, dentro de uma transação segura. Pré-requisitos:
--   * A função public.get_my_tenant_id() já existe.
--   * A tabela public.user_companies já existe e mapeia users→tenants.
--
-- IMPORTANTE: antes de rodar, ajuste o valor abaixo com o tenant_id
-- da empresa "RR Uniformes" (a única funcionária existente, "Felipe",
-- será atribuída a esse tenant).
-- =================================================================

BEGIN;

-- ---- Parâmetro a ajustar ---------------------------------------
-- SUBSTITUA pelo tenant_id real da RR Uniformes (uuid).
-- Você pode descobrir rodando:
--   SELECT uc.tenant_id, u.email
--   FROM public.user_companies uc JOIN auth.users u ON u.id = uc.user_id;
DO $$
DECLARE
    rr_tenant uuid := '00000000-0000-0000-0000-000000000000'::uuid; -- <<< AJUSTE AQUI
BEGIN
    PERFORM set_config('app.rr_tenant', rr_tenant::text, true);
END $$;

-- =================================================================
-- 1. ADICIONAR COLUNA tenant_id NAS TABELAS QUE ESTÃO SEM
-- =================================================================

ALTER TABLE public.insumos_especiais
    ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT public.get_my_tenant_id();

ALTER TABLE public.insumos_especiais_opcoes
    ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT public.get_my_tenant_id();

ALTER TABLE public.compras
    ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT public.get_my_tenant_id();

ALTER TABLE public.consumo_estoque
    ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT public.get_my_tenant_id();

ALTER TABLE public.funcionarios
    ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT public.get_my_tenant_id();

ALTER TABLE public.estoque_insumos
    ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT public.get_my_tenant_id();

ALTER TABLE public.movimentacoes_estoque
    ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT public.get_my_tenant_id();

-- =================================================================
-- 2. BACKFILL — derivar tenant_id a partir das tabelas relacionadas
-- =================================================================

-- compras: deriva do insumo
UPDATE public.compras c
   SET tenant_id = i.tenant_id
  FROM public.insumos i
 WHERE c.insumo_id = i.id
   AND c.tenant_id IS NULL;

-- consumo_estoque: deriva do insumo
UPDATE public.consumo_estoque c
   SET tenant_id = i.tenant_id
  FROM public.insumos i
 WHERE c.insumo_id = i.id
   AND c.tenant_id IS NULL;

-- estoque_insumos: deriva do insumo
UPDATE public.estoque_insumos e
   SET tenant_id = i.tenant_id
  FROM public.insumos i
 WHERE e.insumo_id = i.id
   AND e.tenant_id IS NULL;

-- movimentacoes_estoque: deriva do insumo
UPDATE public.movimentacoes_estoque m
   SET tenant_id = i.tenant_id
  FROM public.insumos i
 WHERE m.insumo_id = i.id
   AND m.tenant_id IS NULL;

-- insumos_especiais_opcoes: deriva do insumo real apontado
UPDATE public.insumos_especiais_opcoes o
   SET tenant_id = i.tenant_id
  FROM public.insumos i
 WHERE o.insumo_id = i.id
   AND o.tenant_id IS NULL;

-- insumos_especiais: pega o tenant majoritário entre suas opções
UPDATE public.insumos_especiais ie
   SET tenant_id = sub.tenant_id
  FROM (
        SELECT o.insumo_especial_id,
               (array_agg(o.tenant_id ORDER BY cnt DESC))[1] AS tenant_id
          FROM (
                SELECT insumo_especial_id, tenant_id, count(*) cnt
                  FROM public.insumos_especiais_opcoes
                 WHERE tenant_id IS NOT NULL
                 GROUP BY insumo_especial_id, tenant_id
               ) o
         GROUP BY o.insumo_especial_id
       ) sub
 WHERE ie.id = sub.insumo_especial_id
   AND ie.tenant_id IS NULL;

-- funcionarios: única linha existente vai para o tenant da RR Uniformes
UPDATE public.funcionarios
   SET tenant_id = current_setting('app.rr_tenant')::uuid
 WHERE tenant_id IS NULL;

-- =================================================================
-- 3. SE AINDA SOBRAR ALGO ÓRFÃO, ABORTA — não queremos vazamento.
-- =================================================================
DO $$
DECLARE
    n int;
BEGIN
    SELECT
        (SELECT count(*) FROM public.insumos_especiais          WHERE tenant_id IS NULL) +
        (SELECT count(*) FROM public.insumos_especiais_opcoes   WHERE tenant_id IS NULL) +
        (SELECT count(*) FROM public.compras                    WHERE tenant_id IS NULL) +
        (SELECT count(*) FROM public.consumo_estoque            WHERE tenant_id IS NULL) +
        (SELECT count(*) FROM public.funcionarios               WHERE tenant_id IS NULL) +
        (SELECT count(*) FROM public.estoque_insumos            WHERE tenant_id IS NULL) +
        (SELECT count(*) FROM public.movimentacoes_estoque      WHERE tenant_id IS NULL)
    INTO n;
    IF n > 0 THEN
        RAISE EXCEPTION 'Existem % linhas sem tenant_id após backfill. Abortando para evitar vazamento.', n;
    END IF;
END $$;

-- =================================================================
-- 4. NOT NULL nas novas colunas
-- =================================================================
ALTER TABLE public.insumos_especiais          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.insumos_especiais_opcoes   ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.compras                    ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.consumo_estoque            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.funcionarios               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.estoque_insumos            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.movimentacoes_estoque      ALTER COLUMN tenant_id SET NOT NULL;

-- =================================================================
-- 5. REMOVER POLICIES PERMISSIVAS QUE QUEBRAM O ISOLAMENTO
--    (RLS aplica OR entre policies — qualquer "USING (true)" anula
--     o filtro por tenant)
-- =================================================================

-- insumos: tinha tenant_policy correta, mas com SELECT aberto
DROP POLICY IF EXISTS "Enable read access for all users" ON public.insumos;

-- compras
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.compras;
DROP POLICY IF EXISTS "Enable read access for all users"      ON public.compras;

-- consumo_estoque
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.consumo_estoque;
DROP POLICY IF EXISTS "Enable read access for all users"      ON public.consumo_estoque;
DROP POLICY IF EXISTS "Enable insert access for all users"    ON public.consumo_estoque;

-- funcionarios
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.funcionarios;
DROP POLICY IF EXISTS "Enable read access for all users"      ON public.funcionarios;

-- estoque_insumos
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.estoque_insumos;

-- movimentacoes_estoque
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.movimentacoes_estoque;

-- insumos_especiais
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.insumos_especiais;

-- insumos_especiais_opcoes
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.insumos_especiais_opcoes;

-- pedidos externos: havia duas policies (tenant_isolation + open). Remove a aberta.
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.pedidos_externos;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.pedido_layouts_externos;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.pedido_itens_externos;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.produto_externo_mapa;

-- =================================================================
-- 6. CRIAR POLICIES TENANT-ONLY NAS TABELAS QUE PRECISAM
-- =================================================================

CREATE POLICY insumos_especiais_tenant_policy ON public.insumos_especiais
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY insumos_especiais_opcoes_tenant_policy ON public.insumos_especiais_opcoes
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY compras_tenant_policy ON public.compras
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY consumo_estoque_tenant_policy ON public.consumo_estoque
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY funcionarios_tenant_policy ON public.funcionarios
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY estoque_insumos_tenant_policy ON public.estoque_insumos
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY movimentacoes_estoque_tenant_policy ON public.movimentacoes_estoque
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- =================================================================
-- 7. POLICIES ANÔNIMAS PARA O QR CODE (PublicConsumePage)
--    Mantidas conscientemente abertas — fluxo público hoje não
--    distingue tenant. Tratar em uma próxima migração (ex.: tenant
--    embutido na URL + edge function com service role).
-- =================================================================
CREATE POLICY anon_read_insumos          ON public.insumos          FOR SELECT TO anon USING (true);
CREATE POLICY anon_read_funcionarios     ON public.funcionarios     FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_consumo        ON public.consumo_estoque  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_read_estoque          ON public.estoque_insumos  FOR SELECT TO anon USING (true);
CREATE POLICY anon_read_compras          ON public.compras          FOR SELECT TO anon USING (true);

COMMIT;

-- =================================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO (rode separadamente):
--   SELECT tablename, policyname, qual
--     FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
-- =================================================================
