-- =============================================================================
-- FIX: "infinite recursion detected in policy for relation workspace_members"
-- (PostgreSQL 42P17)
--
-- Causa: as policies de workspace_members tinham subconsultas à PRÓPRIA tabela
-- ("workspaceId" IN (SELECT ... FROM workspace_members ...)) → recursão infinita.
--
-- Correção: as verificações de membro/OWNER passam a usar funções auxiliares
-- SECURITY DEFINER (contornam o RLS), por isso as policies NUNCA tocam na
-- própria tabela.
--
-- Idempotente: podes correr este ficheiro diretamente no SQL editor do
-- Supabase (ou psql). Substitui as policies antigas por versões corrigidas.
-- =============================================================================

-- 1. Helpers (recriados de forma idempotente)
CREATE OR REPLACE FUNCTION my_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT "workspaceId"::uuid
  FROM workspace_members
  WHERE "userId"::uuid = auth.uid();
$$;

CREATE OR REPLACE FUNCTION my_owned_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT "workspaceId"::uuid
  FROM workspace_members
  WHERE "userId"::uuid = auth.uid() AND role = 'OWNER';
$$;

-- 2. Recriar as policies de workspace_members sem auto-referência
DROP POLICY IF EXISTS "workspace_members_select" ON workspace_members;
CREATE POLICY "workspace_members_select"
ON workspace_members FOR SELECT
USING (
    "userId"::uuid = auth.uid()
    OR "workspaceId"::uuid IN (SELECT my_workspace_ids())
);

DROP POLICY IF EXISTS "workspace_members_insert" ON workspace_members;
CREATE POLICY "workspace_members_insert"
ON workspace_members FOR INSERT
WITH CHECK (
    "workspaceId"::uuid IN (SELECT my_owned_workspace_ids())
);

DROP POLICY IF EXISTS "workspace_members_delete" ON workspace_members;
CREATE POLICY "workspace_members_delete"
ON workspace_members FOR DELETE
USING (
    "userId"::uuid = auth.uid()
    OR "workspaceId"::uuid IN (SELECT my_owned_workspace_ids())
);

DROP POLICY IF EXISTS "workspace_members_update" ON workspace_members;
CREATE POLICY "workspace_members_update"
ON workspace_members FOR UPDATE
USING ("workspaceId"::uuid IN (SELECT my_owned_workspace_ids()))
WITH CHECK ("workspaceId"::uuid IN (SELECT my_owned_workspace_ids()));

-- =============================================================================
-- Verificação rápida (devolve uma linha por policy de workspace_members)
-- =============================================================================
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'workspace_members'
ORDER BY cmd;