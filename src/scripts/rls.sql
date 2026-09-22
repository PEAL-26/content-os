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
-- 17. AI PROVIDERS (scoped por utilizador/workspace)
-- =============================================================================

ALTER TABLE ai_providers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_models  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_headers ENABLE ROW LEVEL SECURITY;

-- Scope:
--   * user-level:  userId = auth.uid()            (dono é o único escritor)
--   * workspace:   workspaceId ∈ my_workspace_ids() (todos os membros leem/usam;
--                  só OWNER escreve)
-- Modelos/headers herdam a visibilidade do provider via FK.

-- ai_providers
CREATE POLICY "ai_providers_select"
ON ai_providers FOR SELECT
USING (
  "userId" = auth.uid()
  OR "workspaceId" IN (SELECT my_workspace_ids())
);

-- INSERT user-level: apenas o próprio utilizador
CREATE POLICY "ai_providers_insert_user"
ON ai_providers FOR INSERT
WITH CHECK ("userId" = auth.uid());

-- INSERT workspace-level: apenas OWNER do workspace
CREATE POLICY "ai_providers_insert_workspace"
ON ai_providers FOR INSERT
WITH CHECK (
  "workspaceId" IN (
    SELECT id FROM workspaces w
    WHERE EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm."workspaceId" = w.id
        AND wm."userId" = auth.uid()
        AND wm.role = 'OWNER'
    )
  )
);

-- UPDATE user-level
CREATE POLICY "ai_providers_update_user"
ON ai_providers FOR UPDATE
USING ("userId" = auth.uid())
WITH CHECK ("userId" = auth.uid());

-- UPDATE workspace-level: apenas OWNER
CREATE POLICY "ai_providers_update_workspace"
ON ai_providers FOR UPDATE
USING (
  "workspaceId" IN (
    SELECT id FROM workspaces w
    WHERE EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm."workspaceId" = w.id
        AND wm."userId" = auth.uid()
        AND wm.role = 'OWNER'
    )
  )
)
WITH CHECK (
  "workspaceId" IN (
    SELECT id FROM workspaces w
    WHERE EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm."workspaceId" = w.id
        AND wm."userId" = auth.uid()
        AND wm.role = 'OWNER'
    )
  )
);

-- DELETE user-level
CREATE POLICY "ai_providers_delete_user"
ON ai_providers FOR DELETE
USING ("userId" = auth.uid());

-- DELETE workspace-level: apenas OWNER
CREATE POLICY "ai_providers_delete_workspace"
ON ai_providers FOR DELETE
USING (
  "workspaceId" IN (
    SELECT id FROM workspaces w
    WHERE EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm."workspaceId" = w.id
        AND wm."userId" = auth.uid()
        AND wm.role = 'OWNER'
    )
  )
);

-- -----------------------------------------------------------------------------
-- ai_provider_models — herda o scope do provider
-- -----------------------------------------------------------------------------
-- Helper: providers visíveis para o utilizador atual
-- (definido inline em cada política para não exigir CREATE FUNCTION)

CREATE POLICY "ai_provider_models_select"
ON ai_provider_models FOR SELECT
USING (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT my_workspace_ids())
  )
);

CREATE POLICY "ai_provider_models_insert"
ON ai_provider_models FOR INSERT
WITH CHECK (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT id FROM workspaces w WHERE EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm."workspaceId" = w.id AND wm."userId" = auth.uid() AND wm.role = 'OWNER'))
  )
);

CREATE POLICY "ai_provider_models_update"
ON ai_provider_models FOR UPDATE
USING (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT id FROM workspaces w WHERE EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm."workspaceId" = w.id AND wm."userId" = auth.uid() AND wm.role = 'OWNER'))
  )
)
WITH CHECK (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT id FROM workspaces w WHERE EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm."workspaceId" = w.id AND wm."userId" = auth.uid() AND wm.role = 'OWNER'))
  )
);

CREATE POLICY "ai_provider_models_delete"
ON ai_provider_models FOR DELETE
USING (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT id FROM workspaces w WHERE EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm."workspaceId" = w.id AND wm."userId" = auth.uid() AND wm.role = 'OWNER'))
  )
);

-- -----------------------------------------------------------------------------
-- ai_provider_headers — herda o scope do provider
-- -----------------------------------------------------------------------------

CREATE POLICY "ai_provider_headers_select"
ON ai_provider_headers FOR SELECT
USING (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT my_workspace_ids())
  )
);

CREATE POLICY "ai_provider_headers_insert"
ON ai_provider_headers FOR INSERT
WITH CHECK (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT id FROM workspaces w WHERE EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm."workspaceId" = w.id AND wm."userId" = auth.uid() AND wm.role = 'OWNER'))
  )
);

CREATE POLICY "ai_provider_headers_update"
ON ai_provider_headers FOR UPDATE
USING (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT id FROM workspaces w WHERE EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm."workspaceId" = w.id AND wm."userId" = auth.uid() AND wm.role = 'OWNER'))
  )
)
WITH CHECK (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT id FROM workspaces w WHERE EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm."workspaceId" = w.id AND wm."userId" = auth.uid() AND wm.role = 'OWNER'))
  )
);

CREATE POLICY "ai_provider_headers_delete"
ON ai_provider_headers FOR DELETE
USING (
  "providerId" IN (
    SELECT id FROM ai_providers
    WHERE "userId" = auth.uid()
       OR "workspaceId" IN (SELECT id FROM workspaces w WHERE EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm."workspaceId" = w.id AND wm."userId" = auth.uid() AND wm.role = 'OWNER'))
  )
);

-- =============================================================================
-- 18. AI SYSTEM PROMPTS (overrides por utilizador/workspace)
-- =============================================================================

ALTER TABLE ai_system_prompts ENABLE ROW LEVEL SECURITY;

-- Leitura: utilizador vê os seus próprios overrides + os dos workspaces de que
-- é membro.
CREATE POLICY "ai_system_prompts_select"
ON ai_system_prompts FOR SELECT
USING (
  "userId" = auth.uid()
  OR "workspaceId" IN (SELECT my_workspace_ids())
);

-- Escrita user-level: apenas o próprio utilizador.
CREATE POLICY "ai_system_prompts_insert_user"
ON ai_system_prompts FOR INSERT
WITH CHECK ("userId" = auth.uid());

CREATE POLICY "ai_system_prompts_update_user"
ON ai_system_prompts FOR UPDATE
USING ("userId" = auth.uid())
WITH CHECK ("userId" = auth.uid());

CREATE POLICY "ai_system_prompts_delete_user"
ON ai_system_prompts FOR DELETE
USING ("userId" = auth.uid());

-- Escrita workspace-level: apenas OWNER do workspace.
CREATE POLICY "ai_system_prompts_insert_workspace"
ON ai_system_prompts FOR INSERT
WITH CHECK (
  "workspaceId" IN (
    SELECT id FROM workspaces w
    WHERE EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm."workspaceId" = w.id
        AND wm."userId" = auth.uid()
        AND wm.role = 'OWNER'
    )
  )
);

CREATE POLICY "ai_system_prompts_update_workspace"
ON ai_system_prompts FOR UPDATE
USING (
  "workspaceId" IN (
    SELECT id FROM workspaces w
    WHERE EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm."workspaceId" = w.id
        AND wm."userId" = auth.uid()
        AND wm.role = 'OWNER'
    )
  )
)
WITH CHECK (
  "workspaceId" IN (
    SELECT id FROM workspaces w
    WHERE EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm."workspaceId" = w.id
        AND wm."userId" = auth.uid()
        AND wm.role = 'OWNER'
    )
  )
);

CREATE POLICY "ai_system_prompts_delete_workspace"
ON ai_system_prompts FOR DELETE
USING (
  "workspaceId" IN (
    SELECT id FROM workspaces w
    WHERE EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm."workspaceId" = w.id
        AND wm."userId" = auth.uid()
        AND wm.role = 'OWNER'
    )
  )
);

-- =============================================================================
-- 19. CONTENT GENERATION PROMPTS (prompt final portátil de peças/roteiros)
-- =============================================================================

ALTER TABLE content_generation_prompts ENABLE ROW LEVEL SECURITY;

-- Acesso via target (piece/script) associado a um workspace: resolvido com as
-- mesmas regras dos targets (peça/roteiro pertence ao utilizador se o artigo do
-- workspace for dele).
-- Alavanca: o targetId aponta para content_pieces/video_scripts, que têm
-- workspaceId com RLS; aqui usamos o artigo→workspace para autorizar.

CREATE POLICY "content_generation_prompts_select"
ON content_generation_prompts FOR SELECT
USING (
  "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
);

CREATE POLICY "content_generation_prompts_insert"
ON content_generation_prompts FOR INSERT
WITH CHECK (
  "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
);

CREATE POLICY "content_generation_prompts_update"
ON content_generation_prompts FOR UPDATE
USING (
  "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
)
WITH CHECK (
  "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
);

CREATE POLICY "content_generation_prompts_delete"
ON content_generation_prompts FOR DELETE
USING (
  "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
);

-- =============================================================================
-- 20. CONTENT PUBLICATIONS (publicações multi-plataforma, polimórfico)
-- =============================================================================

ALTER TABLE content_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_publications_select"
ON content_publications FOR SELECT
USING (
  "targetType" = 'ARTICLE'
    AND "targetId" IN (
      SELECT a.id FROM articles a
      WHERE a."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
);

CREATE POLICY "content_publications_insert"
ON content_publications FOR INSERT
WITH CHECK (
  "targetType" = 'ARTICLE'
    AND "targetId" IN (
      SELECT a.id FROM articles a
      WHERE a."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
);

CREATE POLICY "content_publications_update"
ON content_publications FOR UPDATE
USING (
  "targetType" = 'ARTICLE'
    AND "targetId" IN (
      SELECT a.id FROM articles a
      WHERE a."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
)
WITH CHECK (
  "targetType" = 'ARTICLE'
    AND "targetId" IN (
      SELECT a.id FROM articles a
      WHERE a."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
);

CREATE POLICY "content_publications_delete"
ON content_publications FOR DELETE
USING (
  "targetType" = 'ARTICLE'
    AND "targetId" IN (
      SELECT a.id FROM articles a
      WHERE a."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'PIECE'
    AND "targetId" IN (
      SELECT cp.id FROM content_pieces cp
      WHERE cp."workspaceId" IN (SELECT my_workspace_ids())
    )
  OR "targetType" = 'VIDEO_SCRIPT'
    AND "targetId" IN (
      SELECT vs.id FROM video_scripts vs
      WHERE vs."workspaceId" IN (SELECT my_workspace_ids())
    )
);

-- =============================================================================
-- SECTION 21 — STORAGE: bucket "assets" (artefactos publicados)
-- =============================================================================

-- Cria o bucket (se não existir). publico para leitura (getPublicUrl).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('assets', 'assets', true, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Uploads autenticados
CREATE POLICY "assets_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assets');

-- Uploads/gestão de objeto a nível de owner do ficheiro (update/delete)
CREATE POLICY "assets_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'assets')
WITH CHECK (bucket_id = 'assets');

CREATE POLICY "assets_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'assets');

-- Leitura pública (bucket público)
CREATE POLICY "assets_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'assets');

-- =============================================================================
-- FINAL CHECK
-- =============================================================================

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;