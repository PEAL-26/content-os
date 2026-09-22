-- Scope AI providers by user/workspace + AI system prompts + generation prompts
-- + content publications + asset fields.
--
-- Summary:
--   1. ai_providers: add userId/workspaceId (exactly one set — CHECK), backfill the
--      current rows to the single account user (workspace_members LIMIT 1), remap
--      workspaces.defaultAIProviderId from logical providerId to the row id (UUID).
--   2. New tables: ai_system_prompts (user+workspace overrides, per content type),
--      content_generation_prompts (portable final prompt per item of piece/script),
--      content_publications (multi-platform published links, polymorphic).
--   3. articles/content_pieces/video_scripts: add assetUrl/assetName.
--   4. Migrate plan_items.publishedUrl values into content_publications
--      (platform = 'outros').

-- ---------------------------------------------------------------
-- 1. AI PROVIDERS — scoping
-- ---------------------------------------------------------------

-- Add scope columns
ALTER TABLE "ai_providers" ADD COLUMN "userId" TEXT;
ALTER TABLE "ai_providers" ADD COLUMN "workspaceId" TEXT;

-- Backfill: existing rows (account-global) belong to the single account user.
-- If no member exists yet (fresh DB), unscoped rows are removed so the CHECK
-- below can be added safely.
DO $$
DECLARE
    v_user TEXT;
BEGIN
    SELECT "userId"
    INTO v_user
    FROM "workspace_members"
    ORDER BY "joinedAt" ASC
    LIMIT 1;

    IF v_user IS NOT NULL THEN
        UPDATE "ai_providers"
        SET "userId" = v_user
        WHERE "userId" IS NULL AND "workspaceId" IS NULL;
    ELSE
        DELETE FROM "ai_providers" WHERE "userId" IS NULL AND "workspaceId" IS NULL;
    END IF;
END $$;

-- CHECK: exactly one of userId/workspaceId
ALTER TABLE "ai_providers"
    ADD CONSTRAINT "ai_providers_scope_check"
    CHECK (
        ("userId" IS NOT NULL AND "workspaceId" IS NULL)
        OR ("userId" IS NULL AND "workspaceId" IS NOT NULL)
    );

-- Indexes for scoped lookups
CREATE INDEX "ai_providers_userId_idx" ON "ai_providers"("userId");
CREATE INDEX "ai_providers_workspaceId_idx" ON "ai_providers"("workspaceId");

-- Remap workspaces.defaultAIProviderId: stored the logical providerId
-- ("anthropic", ...) before; now it must point to the ai_providers row id,
-- which is unique across user/workspace scopes.
UPDATE "workspaces" w
SET "defaultAIProviderId" = p."id"
FROM "ai_providers" p
WHERE p."providerId" = w."defaultAIProviderId"
  AND w."defaultAIProviderId" IS NOT NULL
  AND p."userId" = (SELECT "userId" FROM "workspace_members" ORDER BY "joinedAt" ASC LIMIT 1);

-- Clean dangling references that did not match any provider row.
UPDATE "workspaces" SET "defaultAIProviderId" = NULL
WHERE "defaultAIProviderId" IS NOT NULL
  AND "defaultAIProviderId" NOT IN (SELECT "id" FROM "ai_providers");

-- ---------------------------------------------------------------
-- 2. NEW ENUMS
-- ---------------------------------------------------------------

CREATE TYPE "PromptTargetType" AS ENUM ('PIECE', 'VIDEO_SCRIPT');
CREATE TYPE "PublicationTargetType" AS ENUM ('ARTICLE', 'PIECE', 'VIDEO_SCRIPT');

-- ---------------------------------------------------------------
-- 3. AI SYSTEM PROMPTS
-- ---------------------------------------------------------------

CREATE TABLE "ai_system_prompts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT,
    "contentType" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_system_prompts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_system_prompts_scope_check" CHECK (
        ("userId" IS NOT NULL AND "workspaceId" IS NULL)
        OR ("userId" IS NULL AND "workspaceId" IS NOT NULL)
    )
);

-- Unique per scope+contentType (multiple NULLs allowed for the empty side)
CREATE UNIQUE INDEX "ai_system_prompts_userId_contentType_key" ON "ai_system_prompts"("userId", "contentType");
CREATE UNIQUE INDEX "ai_system_prompts_workspaceId_contentType_key" ON "ai_system_prompts"("workspaceId", "contentType");
CREATE INDEX "ai_system_prompts_workspaceId_idx" ON "ai_system_prompts"("workspaceId");

-- ---------------------------------------------------------------
-- 4. CONTENT GENERATION PROMPTS (portable final prompt per item)
-- ---------------------------------------------------------------

CREATE TABLE "content_generation_prompts" (
    "id" TEXT NOT NULL,
    "targetType" "PromptTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "itemKey" TEXT,
    "prompt" TEXT NOT NULL,
    "providerId" TEXT,
    "modelCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_generation_prompts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_generation_prompts_targetType_targetId_idx" ON "content_generation_prompts"("targetType", "targetId");

-- ---------------------------------------------------------------
-- 5. CONTENT PUBLICATIONS (multi-platform, polymorphic)
-- ---------------------------------------------------------------

CREATE TABLE "content_publications" (
    "id" TEXT NOT NULL,
    "targetType" "PublicationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_publications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_publications_targetType_targetId_idx" ON "content_publications"("targetType", "targetId");

-- ---------------------------------------------------------------
-- 6. ASSET FIELDS
-- ---------------------------------------------------------------

ALTER TABLE "articles" ADD COLUMN "assetUrl" TEXT;
ALTER TABLE "articles" ADD COLUMN "assetName" TEXT;
ALTER TABLE "content_pieces" ADD COLUMN "assetUrl" TEXT;
ALTER TABLE "content_pieces" ADD COLUMN "assetName" TEXT;
ALTER TABLE "video_scripts" ADD COLUMN "assetUrl" TEXT;
ALTER TABLE "video_scripts" ADD COLUMN "assetName" TEXT;

-- ---------------------------------------------------------------
-- 7. MIGRATE plan_items.publishedUrl → content_publications
--    PlanItem.publishedUrl is deprecated; existing links become a
--    publication with platform 'outros'.
-- ---------------------------------------------------------------

DO $$
DECLARE
    v_item RECORD;
    v_target_type "PublicationTargetType";
BEGIN
    FOR v_item IN
        SELECT "id", "articleId", "contentPieceId", "publishedUrl", "publishedAt"
        FROM "plan_items"
        WHERE "publishedUrl" IS NOT NULL
          AND ("articleId" IS NOT NULL OR "contentPieceId" IS NOT NULL)
    LOOP
        IF v_item."contentPieceId" IS NOT NULL THEN
            v_target_type := 'PIECE';
        ELSIF v_item."articleId" IS NOT NULL THEN
            v_target_type := 'ARTICLE';
        END IF;

        INSERT INTO "content_publications" (
            "id",
            "targetType",
            "targetId",
            "platform",
            "url",
            "publishedAt",
            "createdAt"
        )
        VALUES (
            gen_random_uuid()::text,
            v_target_type,
            COALESCE(v_item."contentPieceId", v_item."articleId"),
            'outros',
            v_item."publishedUrl",
            COALESCE(v_item."publishedAt", CURRENT_TIMESTAMP),
            CURRENT_TIMESTAMP
        );
    END LOOP;
END $$;