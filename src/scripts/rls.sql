-- =============================================================================
-- ContentOS — Row Level Security (RLS)
-- Executar: supabase db execute --file rls.sql
-- Ou: psql $DATABASE_URL -f rls.sql
-- =============================================================================

-- =============================================================================
-- 1. ACTIVAR RLS
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
-- 2. FUNÇÃO AUXILIAR
-- =============================================================================

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

-- =============================================================================
-- 3. WORKSPACES
-- =============================================================================

CREATE POLICY "workspaces_select"
ON workspaces FOR SELECT
USING (id::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "workspaces_insert"
ON workspaces FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "workspaces_update"
ON workspaces FOR UPDATE
USING (
  id::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role = 'OWNER'
  )
);

CREATE POLICY "workspaces_delete"
ON workspaces FOR DELETE
USING (
  id::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role = 'OWNER'
  )
);

-- =============================================================================
-- 4. WORKSPACE MEMBERS
-- =============================================================================

CREATE POLICY "workspace_members_select"
ON workspace_members FOR SELECT
USING ("userId"::uuid = auth.uid() OR "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid 
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role = 'OWNER'
));

-- Inserção
CREATE POLICY "workspace_members_insert"
ON workspace_members FOR INSERT
WITH CHECK (
    -- só OWNER pode adicionar
    "workspaceId"::uuid IN (
        SELECT "workspaceId"::uuid 
        FROM workspace_members
        WHERE "userId"::uuid = auth.uid() AND role = 'OWNER'
    )
);

-- Deleção
CREATE POLICY "workspace_members_delete"
ON workspace_members FOR DELETE
USING (
    "userId"::uuid = auth.uid()
    OR "workspaceId"::uuid IN (
        SELECT "workspaceId"::uuid
        FROM workspace_members
        WHERE "userId"::uuid = auth.uid() AND role = 'OWNER'
    )
);

-- Update (alterar role)
CREATE POLICY "workspace_members_update"
ON workspace_members FOR UPDATE
USING (
    "workspaceId"::uuid IN (
        SELECT "workspaceId"::uuid
        FROM workspace_members
        WHERE "userId"::uuid = auth.uid() AND role = 'OWNER'
    )
);

-- =============================================================================
-- 5. WORKSPACE OWNER TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION create_workspace_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO workspace_members ("workspaceId", "userId", role)
  VALUES (NEW.id, auth.uid(), 'OWNER');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_workspace_created
AFTER INSERT ON workspaces
FOR EACH ROW
EXECUTE FUNCTION create_workspace_owner();

-- =============================================================================
-- 6. PRODUCTS
-- =============================================================================

CREATE POLICY "products_select"
ON products FOR SELECT
USING ("workspaceId"::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "products_insert"
ON products FOR INSERT
WITH CHECK (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "products_update"
ON products FOR UPDATE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "products_delete"
ON products FOR DELETE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

-- =============================================================================
-- 7. PILLAR CONFIGS
-- =============================================================================

CREATE POLICY "pillar_configs_select"
ON pillar_configs FOR SELECT
USING ("workspaceId"::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "pillar_configs_insert"
ON pillar_configs FOR INSERT
WITH CHECK (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "pillar_configs_update"
ON pillar_configs FOR UPDATE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "pillar_configs_delete"
ON pillar_configs FOR DELETE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role = 'OWNER'
  )
);

-- =============================================================================
-- 8. CHANNEL CONFIGS
-- =============================================================================

CREATE POLICY "channel_configs_select"
ON channel_configs FOR SELECT
USING ("workspaceId"::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "channel_configs_insert"
ON channel_configs FOR INSERT
WITH CHECK (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "channel_configs_update"
ON channel_configs FOR UPDATE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "channel_configs_delete"
ON channel_configs FOR DELETE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role = 'OWNER'
  )
);

-- =============================================================================
-- 9. TAGS
-- =============================================================================

CREATE POLICY "tags_select"
ON tags FOR SELECT
USING ("workspaceId"::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "tags_insert"
ON tags FOR INSERT
WITH CHECK (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "tags_update"
ON tags FOR UPDATE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "tags_delete"
ON tags FOR DELETE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

-- =============================================================================
-- 10. ARTICLES
-- =============================================================================

CREATE POLICY "articles_select"
ON articles FOR SELECT
USING ("workspaceId"::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "articles_insert"
ON articles FOR INSERT
WITH CHECK (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "articles_update"
ON articles FOR UPDATE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "articles_delete"
ON articles FOR DELETE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

-- =============================================================================
-- 11. ARTICLE_TAGS
-- =============================================================================

CREATE POLICY "article_tags_select"
ON article_tags FOR SELECT
USING ("articleId" IN (
    SELECT id FROM articles WHERE "workspaceId"::uuid IN (SELECT my_workspace_ids())
));

CREATE POLICY "article_tags_insert"
ON article_tags FOR INSERT
WITH CHECK ("articleId" IN (
    SELECT id FROM articles WHERE "workspaceId"::uuid IN (
        SELECT "workspaceId"::uuid FROM workspace_members WHERE "userId"::uuid = auth.uid()
    )
));

CREATE POLICY "article_tags_delete"
ON article_tags FOR DELETE
USING ("articleId" IN (
    SELECT id FROM articles WHERE "workspaceId"::uuid IN (SELECT my_workspace_ids())
));

-- =============================================================================
-- 12. CONTENT_PIECES
-- =============================================================================

CREATE POLICY "content_pieces_select"
ON content_pieces FOR SELECT
USING ("workspaceId"::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "content_pieces_insert"
ON content_pieces FOR INSERT
WITH CHECK (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "content_pieces_update"
ON content_pieces FOR UPDATE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "content_pieces_delete"
ON content_pieces FOR DELETE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

-- =============================================================================
-- 13. VIDEO_SCRIPTS
-- =============================================================================

CREATE POLICY "video_scripts_select"
ON video_scripts FOR SELECT
USING ("workspaceId"::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "video_scripts_insert"
ON video_scripts FOR INSERT
WITH CHECK (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "video_scripts_update"
ON video_scripts FOR UPDATE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "video_scripts_delete"
ON video_scripts FOR DELETE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

-- =============================================================================
-- 14. WEEKLY_PLANS
-- =============================================================================

CREATE POLICY "weekly_plans_select"
ON weekly_plans FOR SELECT
USING ("workspaceId"::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "weekly_plans_insert"
ON weekly_plans FOR INSERT
WITH CHECK (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "weekly_plans_update"
ON weekly_plans FOR UPDATE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "weekly_plans_delete"
ON weekly_plans FOR DELETE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

-- =============================================================================
-- 15. PLAN_ITEMS
-- =============================================================================

CREATE POLICY "plan_items_select"
ON plan_items FOR SELECT
USING ("workspaceId"::uuid IN (SELECT my_workspace_ids()));

CREATE POLICY "plan_items_insert"
ON plan_items FOR INSERT
WITH CHECK (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "plan_items_update"
ON plan_items FOR UPDATE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

CREATE POLICY "plan_items_delete"
ON plan_items FOR DELETE
USING (
  "workspaceId"::uuid IN (
    SELECT "workspaceId"::uuid
    FROM workspace_members
    WHERE "userId"::uuid = auth.uid() AND role IN ('OWNER', 'EDITOR')
  )
);

-- =============================================================================
-- FINAL CHECK
-- =============================================================================

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;