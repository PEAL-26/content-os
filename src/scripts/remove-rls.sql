-- =============================================================================
-- ContentOS — REMOVER RLS (ainda não precisamos de isolamento multi-tenant)
--
-- O que este script faz (idempotente, podes correr quantas vezes quiseres):
--   1. Apaga TODAS as policies do schema public (tabelas da app).
--   2. Desactiva ROW LEVEL SECURITY em todas as tabelas do schema public.
--   3. Apaga o trigger on_workspace_created + create_workspace_owner()
--      (CAUSA do erro 23502: inseria o OWNER sem "id" → null value in column
--      "id" of relation "workspace_members" violates not-null constraint).
--   4. Apaga as funções auxiliares do RLS (my_workspace_ids et al.).
--
-- Correr no SQL editor do Supabase, ou: psql $DATABASE_URL -f remove-rls.sql
--
-- NOTA: as policies de storage.objects (bucket 'assets') MANTÊM-SE.
--       O RLS do storage está sempre activo e sem elas os uploads/downloads
--       da app (publication.service.ts) deixam de funcionar. Não são
--       isolamento multi-tenant — são o acesso ao bucket público.
-- =============================================================================

-- 1. Remover todas as policies do schema public
DO $$
DECLARE
  pol     text;
  drops   text[];
BEGIN
  SELECT array_agg(format('DROP POLICY IF EXISTS %I ON public.%I;', policyname, tablename))
    INTO drops
  FROM pg_policies
  WHERE schemaname = 'public';

  IF drops IS NOT NULL THEN
    FOREACH pol IN ARRAY drops LOOP
      EXECUTE pol;
    END LOOP;
  END IF;
END $$;

-- 2. Desactivar RLS em todas as tabelas do schema public
DO $$
DECLARE
  tbl       text;
  alters    text[];
BEGIN
  SELECT array_agg(format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', c.relname))
    INTO alters
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p');

  IF alters IS NOT NULL THEN
    FOREACH tbl IN ARRAY alters LOOP
      EXECUTE tbl;
    END LOOP;
  END IF;
END $$;

-- 3. Trigger do OWNER (raiz do erro 23502) + funções auxiliares do RLS
DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
DROP FUNCTION IF EXISTS create_workspace_owner();
DROP FUNCTION IF EXISTS my_workspace_ids();
DROP FUNCTION IF EXISTS my_owned_workspace_ids();

-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================

-- Deve devolver 0 linhas com rls_enabled = true
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relrowsecurity
ORDER BY 1;

-- Deve devolver 0 (policies restantes no schema public)
SELECT count(*) AS remaining_policies
FROM pg_policies
WHERE schemaname = 'public';

-- Deve devolver 0 (o trigger foi removido)
SELECT count(*) AS owner_trigger_exists
FROM pg_trigger
WHERE tgname = 'on_workspace_created';
