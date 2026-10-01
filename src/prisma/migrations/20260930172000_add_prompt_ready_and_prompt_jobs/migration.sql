-- =============================================================================
-- Gerar o prompt da peça sem gerar a peça (ver .plans/20260930.171759-*)
--
-- 1. `ContentPieceStatus.PROMPT_READY` — peça criada apenas com o prompt
--    gravado, ainda sem conteúdo (estado de trabalho; não conta como DRAFT a
--    aprovar e não aparece nas listagens de conteúdo por omissão).
-- 2. `GenerationJobType.CONTENT_PROMPT` — job que escreve o prompt da peça
--    (meta-prompting) em vez de gerar o conteúdo.
-- 3. `GenerationJobType.CONTENT_ITEM`  — job que regenera UM item da peça
--    (slide N / tweet N) a partir do prompt desse item.
-- 4. `content_generation_prompts.editedAt` — marca de o prompt ter sido editado
--    à mão, para a UI poder confirmar antes de um job reconstruir o prompt.
-- 5. Índice único (targetType, targetId, itemKey) — o invariant "um prompt por
--    item" passa a ser garantido pela BD. Antes, uma peça podia ficar com duas
--    linhas 'main' (uma do utilizador, outra reconstruída) sem nada reclamar.
--
-- Sem tabelas novas: os prompts continuam em `content_generation_prompts`
-- (prompt da peça = itemKey 'main'; prompts por item = 'slide-N'/'tweet-N').
--
-- Nota: `ALTER TYPE ... ADD VALUE` não pode correr dentro de uma transacção em
-- que o valor novo seja usado (PG < 12). Aqui é só DDL, sem usar os valores.
-- =============================================================================

ALTER TYPE "ContentPieceStatus" ADD VALUE IF NOT EXISTS 'PROMPT_READY';
ALTER TYPE "GenerationJobType" ADD VALUE IF NOT EXISTS 'CONTENT_PROMPT';
ALTER TYPE "GenerationJobType" ADD VALUE IF NOT EXISTS 'CONTENT_ITEM';

-- Marca de edição manual do prompt (NULL = gerado/reconstruído pela IA).
ALTER TABLE "content_generation_prompts"
    ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);

-- Limpa duplicados herdados da geração anterior à restrição: por
-- (targetType, targetId, itemKey) só sobrevive a linha mais recente, que é a
-- última escrita do job. Normaliza primeiro o `itemKey` NULL, senão o índice
-- único abaixo não o veria (NULL != NULL em índices únicos).
UPDATE "content_generation_prompts" SET "itemKey" = 'main' WHERE "itemKey" IS NULL;

DELETE FROM "content_generation_prompts" a
      USING "content_generation_prompts" b
      WHERE a."targetType" = b."targetType"
        AND a."targetId" = b."targetId"
        AND a."itemKey" = b."itemKey"
        AND (
            a."createdAt" < b."createdAt"
            OR (a."createdAt" = b."createdAt" AND a."id" < b."id")
        );

-- Nome por convenção do Prisma para `@@unique` (tabela_colunas_key), igual a
-- `pillar_configs_workspaceId_pillar_key` & company — outro nome faria o
-- `migrate dev` reportar drift e querer DROP+CREATE.
CREATE UNIQUE INDEX IF NOT EXISTS "content_generation_prompts_targetType_targetId_itemKey_key"
    ON "content_generation_prompts" ("targetType", "targetId", "itemKey");
