-- Make AI providers account-global instead of per-workspace.
--
-- Previously each workspace received its own boilerplate set of default
-- providers (anthropic, openai, ...). Globalizing keeps a single set per
-- account, so the duplicated rows are removed here; the app lazily re-seeds
-- the defaults once per account on first use.

DELETE FROM "ai_provider_headers";
DELETE FROM "ai_provider_models";
DELETE FROM "ai_providers";

ALTER TABLE "ai_providers" DROP CONSTRAINT IF EXISTS "ai_providers_workspaceId_fkey";
ALTER TABLE "ai_providers" DROP COLUMN "workspaceId";