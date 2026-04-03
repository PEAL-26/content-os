-- =============================================================================
-- ContentOS — Row Level Security (RLS)
-- Executar: supabase db execute --file rls.sql
-- Ou: psql $DATABASE_URL -f rls.sql
-- =============================================================================

-- =============================================================================
-- 1. ACTIVAR RLS EM TODAS AS TABELAS
-- =============================================================================

ALTER TABLE workspaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pillar_configs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_configs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_pieces       ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_scripts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_items           ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. FUNÇÃO AUXILIAR — workspaces do utilizador autenticado
-- Evita subqueries repetidas em cada política
-- =============================================================================

CREATE OR REPLACE FUNCTION my_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT workspaceId
  FROM public.workspace_members
  WHERE userId = auth.uid();
$$;
