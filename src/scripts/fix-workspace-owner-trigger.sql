-- =============================================================================
-- FIX: erro ao adicionar workspace
--   null value in column "id" of relation "workspace_members"
--   violates not-null constraint
--   DETAIL: Failing row contains (null, <workspaceId>, <userId>, OWNER, ...)
--
-- Causa: o trigger on_workspace_created (após INSERT em workspaces) inseria o
-- membro OWNER sem "id", mas a coluna "workspace_members.id" é TEXT NOT NULL
-- sem DEFAULT na BD (o @default(uuid()) do Prisma é gerado só no client).
--
-- Correcções:
--   1. A função do trigger passa a gerar o id (gen_random_uuid) e ignora
--      duplicados (caso o serviço já tenha inserido o OWNER).
--   2. Passa a ignorar inserts sem sessão autenticada (auth.uid() IS NULL).
--   3. Definimos um DEFAULT na coluna "id" como rede de segurança para
--      qualquer outro INSERT directo (via SQL/editor) que omita o id.
--
-- Idempotente: podes correr este ficheiro vezes vezes no SQL editor do
-- Supabase (ou via psql). Depois, tenta criar o workspace outra vez.
-- =============================================================================

-- 1. Rede de segurança: DEFAULT na coluna id (gen_random_uuid()::text)
ALTER TABLE workspace_members
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- 2. Recriar a função do trigger com id gerado
CREATE OR REPLACE FUNCTION create_workspace_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  owner_uid uuid := auth.uid();
BEGIN
  -- Inserts sem sessão autenticada não têm dono para associar.
  IF owner_uid IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO workspace_members (id, "workspaceId", "userId", role)
  VALUES (gen_random_uuid()::text, NEW.id, owner_uid::text, 'OWNER')
  ON CONFLICT ("workspaceId", "userId") DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Garantir que o trigger existe (caso nunca tenha sido criado)
DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created
AFTER INSERT ON workspaces
FOR EACH ROW
EXECUTE FUNCTION create_workspace_owner();

-- =============================================================================
-- Verificação rápida
-- =============================================================================
-- Deve devolver: id | workspaceId | userId | role | has_default
SELECT
  c.attname AS id_column,
  pg_get_expr(d.adbin, d.adrelid) AS has_default
FROM pg_attribute c
JOIN pg_class t ON t.oid = c.attrelid
LEFT JOIN pg_attrdef d ON d.adrelid = c.attrelid AND d.adnum = c.attnum
WHERE t.relname = 'workspace_members' AND c.attname = 'id';
