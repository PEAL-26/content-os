-- =============================================================================
-- M3 — Proveniência dos artefactos + tabela content_media_prompts
--
-- Upload continua a ser o caminho comum: `source` e `status` têm defaults
-- UPLOAD/READY, por isso as linhas existentes não precisam de backfill.
-- =============================================================================

CREATE TYPE "AssetSource" AS ENUM ('UPLOAD', 'GENERATED');

CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

ALTER TABLE "content_assets" ADD COLUMN "source" "AssetSource" NOT NULL DEFAULT 'UPLOAD';
ALTER TABLE "content_assets" ADD COLUMN "status" "AssetStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "content_assets" ADD COLUMN "error" TEXT;
ALTER TABLE "content_assets" ADD COLUMN "itemKey" TEXT;
ALTER TABLE "content_assets" ADD COLUMN "mediaPromptId" TEXT;
ALTER TABLE "content_assets" ADD COLUMN "providerId" TEXT;
ALTER TABLE "content_assets" ADD COLUMN "modelCode" TEXT;

-- A grelha de artefactos passa a filtrar por estado (spinner / erro).
CREATE INDEX "content_assets_status_idx" ON "content_assets"("status");

-- -----------------------------------------------------------------------------
-- Prompts de media: genéricos e portáteis, um por (alvo, modalidade, item)
-- -----------------------------------------------------------------------------
CREATE TABLE "content_media_prompts" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "targetType" "AssetTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "modality" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "negativePrompt" TEXT,
  "aspectRatio" TEXT,
  "providerId" TEXT,
  "modelCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt" TIMESTAMP(3),

  CONSTRAINT "content_media_prompts_pkey" PRIMARY KEY ("id")
);

-- Um prompt por (alvo, modalidade, item): "slide-1" da imagem não colide com
-- "slide-1" do áudio.
--
-- ⚠️ Os NOMES das indexes são os que o Prisma deriva de `@@unique`/`@@index` no
-- schema — camelCase, porque vem dos nomes dos campos. Escrever aqui um nome
-- em snake_case "mais legível" funciona, mas deixa a base em drift: o próximo
-- `prisma migrate dev` gera uma migração que as renomeia. Confirmado com
-- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`.
CREATE UNIQUE INDEX "content_media_prompts_targetType_targetId_modality_itemKey_key"
  ON "content_media_prompts"("targetType", "targetId", "modality", "itemKey");
CREATE INDEX "content_media_prompts_workspaceId_idx" ON "content_media_prompts"("workspaceId");
CREATE INDEX "content_media_prompts_targetType_targetId_idx"
  ON "content_media_prompts"("targetType", "targetId");