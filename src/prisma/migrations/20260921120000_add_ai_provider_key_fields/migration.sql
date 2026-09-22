-- Add key/config fields to AI providers.
--
-- The globalizing migration (20260921000000_make_ai_providers_global) only
-- removed the workspace scoping; this migration brings the tables in line with
-- prisma/schema.prisma by adding the API-key ciphertext/IV columns and the
-- per-provider/default-model config payloads.

-- AlterTable: AIProvider
ALTER TABLE "ai_providers" ADD COLUMN "apiKeyEncrypted" TEXT;
ALTER TABLE "ai_providers" ADD COLUMN "apiKeyIv" TEXT;
ALTER TABLE "ai_providers" ADD COLUMN "config" JSONB;

-- AlterTable: AIProviderModel
ALTER TABLE "ai_provider_models" ADD COLUMN "config" JSONB;