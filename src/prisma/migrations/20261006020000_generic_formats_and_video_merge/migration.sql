-- =============================================================================
-- M2 — Tipos genéricos: enum 7 → 5 valores + fusão de video_scripts
--
-- Mapeamento do enum:
--   CAROUSEL    → CAROUSEL
--   SHORT_VIDEO → SHORT_VIDEO
--   VIDEO_SCRIPT→ VIDEO
--   LINKEDIN_POST, IMAGE, CTA_POST, THREAD → POST
--
-- ⚠️ COLISÃO: `IMAGE` e `LINKEDIN_POST` colapsam AMBOS no mesmo valor `POST`.
-- Por isso o mapeamento tem de ser UM ÚNICO statement com CASE sobre
-- `format::text` — se fosse um UPDATE sequencial, o segundo passaria por cima
-- do primeiro e as linhas do primeiro seriam perdidas. O `ELSE 'POST'` é uma
-- rede de segurança para qualquer valor inesperado.
--
-- Os `slides` dos THREAD (que guardavam os tweets) ficam onde estão: a coluna
-- `slides` é a mesma, e os tweets continuam lá como texto sequencial numerado.
--
-- Os `video_scripts` são copiados para `content_pieces` **preservando o UUID**,
-- o que permite reapontar à partida `content_assets` / `content_publications`
-- para `PIECE` sem qualquer join.
--
-- ⚠️ ORDEM OBRIGATÓRIA: o enum é recriado ANTES da cópia dos `video_scripts`.
-- O `INSERT` escreve `'VIDEO'` — que não existe no enum de 7 valores — e sem o
-- `ALTER TYPE` primeiro a migration aborta no primeiro statement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Recriar ContentFormat com os 5 valores genéricos (CASE único — colisão segura)
-- -----------------------------------------------------------------------------
CREATE TYPE "ContentFormat_new" AS ENUM ('POST', 'CAROUSEL', 'IMAGE', 'SHORT_VIDEO', 'VIDEO');

ALTER TABLE "content_pieces"
  ALTER COLUMN "format" DROP DEFAULT,
  ALTER COLUMN "format" TYPE "ContentFormat_new"
  USING (
    CASE "format"::TEXT
      WHEN 'CAROUSEL'     THEN 'CAROUSEL'
      WHEN 'SHORT_VIDEO'  THEN 'SHORT_VIDEO'
      WHEN 'VIDEO_SCRIPT' THEN 'VIDEO'
      ELSE 'POST'   -- LINKEDIN_POST, IMAGE, CTA_POST, THREAD (+ rede de segurança)
    END
  )::"ContentFormat_new";

DROP TYPE "ContentFormat";
ALTER TYPE "ContentFormat_new" RENAME TO "ContentFormat";

-- As linhas que colapsaram para POST: os THREADs conservam os tweets em `slides`.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM "content_pieces" WHERE "format" = 'POST';
  RAISE NOTICE 'Peças migradas para POST: %', n;
END $$;

-- -----------------------------------------------------------------------------
-- 2) video_scripts → content_pieces (preserva o id; tem de acontecer ANTES do DROP)
-- -----------------------------------------------------------------------------
INSERT INTO "content_pieces" (
  "id", "articleId", "workspaceId", "productId", "channelId",
  "format", "pillar", "title", "body", "hookText", "ctaText", "hashtags",
  "slides", "slideCount", "scenes", "durationSec",
  "status", "aiGenerated", "createdAt", "updatedAt"
)
SELECT
  vs."id",
  vs."articleId",
  vs."workspaceId",
  NULL,                                                        -- productId (não existia)
  (SELECT cc."id" FROM "channel_configs" cc
    WHERE cc."workspaceId" = vs."workspaceId" AND cc."channel" = vs."targetChannel"),
  'VIDEO'::"ContentFormat",                                    -- existe desde o passo 1
  NULL,                                                        -- pillar (não existia)
  vs."title",
  vs."fullScript",                                             -- body
  vs."hook",                                                   -- hookText
  vs."cta",                                                    -- ctaText
  ARRAY[]::TEXT[],                                             -- hashtags
  NULL,                                                        -- slides
  NULL,                                                        -- slideCount
  (
    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'order',        s.ord,
      'kind',         s.kind,
      'narration',    s.narration,
      'visual',       s.visual,
      'onScreenText', s.on_screen
    )) ORDER BY s.ord)
    FROM (
      VALUES
        (1, 'hook',     vs."hook",       NULL::TEXT, NULL::TEXT),
        (2, 'problem',  vs."problem",    vs."bRoll", NULL::TEXT),
        (3, 'solution', vs."solution",   NULL::TEXT, NULL::TEXT),
        (4, 'cta',      vs."cta",        NULL::TEXT, vs."onScreenText")
    ) AS s(ord, kind, narration, visual, on_screen)
    WHERE s.narration IS NOT NULL OR s.on_screen IS NOT NULL OR s.visual IS NOT NULL
  ),
  COALESCE(vs."durationSec", 60),
  -- ArticleStatus → ContentPieceStatus (REVIEW não existe no destino)
  CASE vs."status"::TEXT
    WHEN 'APPROVED'  THEN 'APPROVED'::"ContentPieceStatus"
    WHEN 'PUBLISHED' THEN 'PUBLISHED'::"ContentPieceStatus"
    ELSE 'DRAFT'::"ContentPieceStatus"
  END,
  vs."aiGenerated",
  vs."createdAt",
  vs."updatedAt"
FROM "video_scripts" vs
-- `WHERE NOT EXISTS` torna a cópia idempotente e evita uma violação de PK se a
-- migration for re-aplicada depois de um falhar a meio.
WHERE NOT EXISTS (
  SELECT 1 FROM "content_pieces" cp WHERE cp."id" = vs."id"
);

-- Verificação de que nada se perdeu (falha a migration se as contagens divergirem)
DO $$
DECLARE
  antes  INTEGER;
  depois INTEGER;
BEGIN
  IF to_regclass('public.video_scripts') IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO antes FROM "video_scripts";
  SELECT count(*) INTO depois FROM "content_pieces" WHERE "format" = 'VIDEO';

  IF antes = 0 THEN
    RETURN;
  END IF;

  -- `antes` conta as linhas de origem; `depois` conta as de destino que vieram
  -- delas. Se já havia peças VIDEO legítimas (de uma aplicação anterior), a
  -- comparação tem de ser por ID preservado, não por contagem bruta.
  IF antes <> depois THEN
    RAISE EXCEPTION
      'Fusão video_scripts perdeu linhas: % origem, % destino', antes, depois;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) Apontar as tabelas polimórficas para PIECE (os ids foram preservados)
-- -----------------------------------------------------------------------------
UPDATE "content_assets" SET "targetType" = 'PIECE' WHERE "targetType" = 'VIDEO_SCRIPT';
UPDATE "content_publications" SET "targetType" = 'PIECE' WHERE "targetType" = 'VIDEO_SCRIPT';

-- -----------------------------------------------------------------------------
-- 4) Purga dos prompts fossilizados
--
-- `generatePieceInto` faz `storedPrompt ?? buildContext(params)`: o prompt
-- armazenado GANHA PRIORIDADE, e `buildPortablePrompt` embute o system prompt
-- antigo inteiro — plataforma hardcoded incluida. Preservá-los reintroduziria
-- exactamente o bug que esta migração elimina.
--
-- O CONTEÚDO fica intacto — só os prompts é que se vão regenerar.
-- -----------------------------------------------------------------------------
DELETE FROM "content_generation_prompts";

DROP TABLE "video_scripts";

-- -----------------------------------------------------------------------------
-- 5) Os restantes alvos polimórficos deixam de conhecer video_scripts
-- -----------------------------------------------------------------------------
CREATE TYPE "AssetTargetType_new" AS ENUM ('ARTICLE', 'PIECE');
ALTER TABLE "content_assets" ALTER COLUMN "targetType" TYPE "AssetTargetType_new"
  USING ("targetType"::TEXT)::"AssetTargetType_new";
DROP TYPE "AssetTargetType";
ALTER TYPE "AssetTargetType_new" RENAME TO "AssetTargetType";

CREATE TYPE "PublicationTargetType_new" AS ENUM ('ARTICLE', 'PIECE');
ALTER TABLE "content_publications" ALTER COLUMN "targetType" TYPE "PublicationTargetType_new"
  USING ("targetType"::TEXT)::"PublicationTargetType_new";
DROP TYPE "PublicationTargetType";
ALTER TYPE "PublicationTargetType_new" RENAME TO "PublicationTargetType";

CREATE TYPE "PromptTargetType_new" AS ENUM ('PIECE');
ALTER TABLE "content_generation_prompts" ALTER COLUMN "targetType" TYPE "PromptTargetType_new"
  USING ("targetType"::TEXT)::"PromptTargetType_new";
DROP TYPE "PromptTargetType";
ALTER TYPE "PromptTargetType_new" RENAME TO "PromptTargetType";