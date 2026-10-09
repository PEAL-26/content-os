-- =============================================================================
-- M1 — Tipos genéricos: colunas de suporte (aditiva, sem risco)
--   channel_configs.rules        → overrides de regras de plataforma (Json)
--   workspaces.artifactModels    → { image?, audio?, video? } com modelCode
--   ai_provider_models.modalities→ que dados o modelo produz
--   content_pieces.scenes/durationSec → decomposição de vídeo
-- =============================================================================

-- 1) Regras de plataforma por canal (null = herdar defaults de código)
ALTER TABLE "channel_configs" ADD COLUMN "rules" JSONB;

-- 2) Modelo por modalidade de artefacto (null = automático por priority)
ALTER TABLE "workspaces" ADD COLUMN "artifactModels" JSONB;

-- 3) Modalidades de saída por modelo (vazio = desconhecido)
ALTER TABLE "ai_provider_models" ADD COLUMN "modalities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 4) Cenas e duração dos vídeos (viram-se linhas na M2)
ALTER TABLE "content_pieces" ADD COLUMN "scenes" JSONB;
ALTER TABLE "content_pieces" ADD COLUMN "durationSec" INTEGER;