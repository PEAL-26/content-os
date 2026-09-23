-- Generation jobs — geração de IA assíncrona via Inngest.
--
-- Summary:
--   1. New enums: GenerationJobType, GenerationJobStatus.
--   2. New table: generation_jobs (polymorphic — um job por pedido).
--      items  → estados por item nos batches de CONTENT_PIECES
--      params → snapshot dos parâmetros (para retry com "Tentar novamente")
--      runId  → Inngest run id (idempotência)
--   3. No RLS: RLS está globalmente desligado neste projeto; a tabela é
--      legível pela app via supabase-js (fetch inicial + sanity poll) e
--      escrita pelo job server-side via Prisma.
--   Nota: adicionar a tabela à publicação supabase_realtime (script separado,
--   scripts/add-realtime-generation-jobs.sql) para os estados chegarem à UI.

CREATE TYPE "GenerationJobType" AS ENUM ('NEW_ARTICLE', 'CONTENT_PIECES', 'VIDEO_SCRIPT');
CREATE TYPE "GenerationJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "jobType" "GenerationJobType" NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "items" JSONB,
    "params" JSONB,
    "runId" TEXT,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "generation_jobs_workspaceId_status_idx" ON "generation_jobs"("workspaceId", "status");
CREATE INDEX "generation_jobs_jobType_targetId_status_idx" ON "generation_jobs"("jobType", "targetId", "status");
CREATE INDEX "generation_jobs_createdAt_idx" ON "generation_jobs"("createdAt");