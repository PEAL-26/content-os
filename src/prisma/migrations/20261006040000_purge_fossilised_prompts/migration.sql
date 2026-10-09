-- =============================================================================
-- M4 — Publicações com taxonomia única + purge de prompts fossilizados
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) content_publications.platform: texto livre → enum SocialChannel
--
-- ⚠️ ORDEM: o `ALTER COLUMN TYPE` vem ANTES de escrever NULLs. Escrever NULL
-- numa coluna que ainda é `text` seria aceite, mas converter já depois deixaria
-- o default/NOT NULL por resolver. Valores fora do enum (o código antigo
-- aceitava "outros") ficam NULL — e o passo 1b dá conta disso.
-- -----------------------------------------------------------------------------
ALTER TABLE "content_publications" ADD COLUMN "platform_new" "SocialChannel";

UPDATE "content_publications"
SET "platform_new" = "platform"::"SocialChannel"
WHERE "platform" IN (SELECT unnest(enum_range(NULL::"SocialChannel"))::TEXT);

ALTER TABLE "content_publications" DROP COLUMN "platform";
ALTER TABLE "content_publications" RENAME COLUMN "platform_new" TO "platform";

-- 1b) As linhas que ficaram NULL (platform livre que não é um SocialChannel)
-- não podem sobreviver num `NOT NULL`. Como o enum novo é a única taxonomia
-- (Decisão 34), são removidas — e diz-se quantas, em vez de apagar em silêncio.
DO $$
DECLARE orfas INTEGER;
BEGIN
  SELECT count(*) INTO orfas
  FROM "content_publications" WHERE "platform" IS NULL;

  IF orfas > 0 THEN
    RAISE NOTICE
      'content_publications: % publicação(ões) com plataforma fora do enum foram removidas',
      orfas;
    DELETE FROM "content_publications" WHERE "platform" IS NULL;
  END IF;
END $$;

ALTER TABLE "content_publications" ALTER COLUMN "platform" SET NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) Jobs novos + estado EXPIRED
--
-- ⚠️ ORDEM CRÍTICA 1: o `UPDATE` que escreve 'EXPIRED' só pode correr DEPOIS do
-- `ALTER COLUMN TYPE`. A coluna é do enum de 5 valores enquanto isso não
-- acontecer, e escrever 'EXPIRED' nela aborta a migration. Recriar o tipo é
-- precisamente o que torna isto possível.
--
-- ⚠️ ORDEM CRÍTICA 2: o `DROP DEFAULT` tem de vir ANTES do `ALTER COLUMN TYPE`.
-- O Postgres NÃO recasta o default de uma coluna ao mudar-lhe o tipo e aborta
-- com `42804 default for column "status" cannot be cast automatically to type
-- "GenerationJobStatus_new"` — mesmo quando o novo tipo tem o mesmo valor. É o
-- mesmo cuidado que a M2 took no `content_pieces.format`.
-- -----------------------------------------------------------------------------
CREATE TYPE "GenerationJobStatus_new" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED');

ALTER TABLE "generation_jobs" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "generation_jobs" ALTER COLUMN "status" TYPE "GenerationJobStatus_new"
  USING ("status"::TEXT)::"GenerationJobStatus_new";
ALTER TABLE "generation_jobs" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
DROP TYPE "GenerationJobStatus";
ALTER TYPE "GenerationJobStatus_new" RENAME TO "GenerationJobStatus";

-- `jobType` = VIDEO_SCRIPT já não existe no enum novo → remapeado antes do
-- `ALTER COLUMN TYPE` que o deita fora.
UPDATE "generation_jobs" SET "jobType" = 'CONTENT_PIECES' WHERE "jobType" = 'VIDEO_SCRIPT';

CREATE TYPE "GenerationJobType_new" AS ENUM (
  'NEW_ARTICLE', 'CONTENT_PIECES', 'CONTENT_PROMPT', 'CONTENT_ITEM',
  'ARTICLE_METADATA', 'MEDIA_PROMPT', 'MEDIA_ARTIFACT'
);
ALTER TABLE "generation_jobs" ALTER COLUMN "jobType" TYPE "GenerationJobType_new"
  USING ("jobType"::TEXT)::"GenerationJobType_new";
DROP TYPE "GenerationJobType";
ALTER TYPE "GenerationJobType_new" RENAME TO "GenerationJobType";

-- Jobs por correr têm `params` com formatos que deixaram de existir
-- (`LINKEDIN_POST`, `THREAD`, `VIDEO_SCRIPT`...). Reexecutá-los rebentaria.
UPDATE "generation_jobs" SET "status" = 'EXPIRED' WHERE "status" IN ('QUEUED', 'RUNNING');

-- -----------------------------------------------------------------------------
-- 3) Remapear as chaves de ai_system_prompts
--
-- O prompt editável passa a ser POR TIPO GENÉRICO. As regras de plataforma já
-- não vivem na prosa do prompt (vêm num bloco fixo depois), por isso não há
-- chave por tipo+plataforma — é isso que impedia um prompt afinado ao LinkedIn
-- de vazar para o Instagram.
--
-- O QUE COLAPSA (fusão do texto na linha destino) vs O QUE RENOMEIA 1:1:
--
--   renomeia 1:1:  LINKEDIN_POST → POST
--                  VIDEO_SCRIPT  → VIDEO
--   renomeia 1:1:  prompt_LINKEDIN_POST → prompt_POST
--                  prompt_VIDEO_SCRIPT  → prompt_VIDEO
--   fica igual:    CAROUSEL, IMAGE, SHORT_VIDEO
--                  (e prompt_CAROUSEL, prompt_IMAGE, prompt_SHORT_VIDEO — a chave
--                  prompt_IMAGE significa a mesma coisa nos dois mundos: o prompt
--                  do formato imagem)
--   colapsa/fusão: CTA_POST, THREAD → POST
--                   prompt_CTA_POST, prompt_THREAD → prompt_POST
--
-- ⚠️ O PREFIXO `prompt_` PRESERVA-SE. O escritor de prompts tem as SUAS
-- próprias chaves (`prompt_POST`), e perdê-las deixaria o utilizador sem prompt
-- editável para o escritor.
--
-- ⚠️ TAMBÉM: os dois UPDATEs podem colidir com uma linha já existente no
-- mesmo âmbito (o `@@unique([userId, contentType])` e
-- `@@unique([workspaceId, contentType])` do schema). Por isso não são UPDATEs
-- cegos — fundem o texto, e só depois renomeiam. Sem isto, uma base que tivesse
-- as duas linhas abortava a migration.
-- -----------------------------------------------------------------------------

-- 3a) Fusão das que colapsam em POST / prompt_POST (preserva o prefixo).
DO $$
DECLARE
  r RECORD;
  n INTEGER := 0;
BEGIN
  FOR r IN
    SELECT "id", "userId", "workspaceId", "systemPrompt", "contentType"
    FROM "ai_system_prompts"
    WHERE "contentType" IN ('CTA_POST', 'THREAD', 'prompt_CTA_POST', 'prompt_THREAD')
  LOOP
    -- Destino: `prompt_POST` para as chaves `prompt_*`, `POST` para as outras.
    UPDATE "ai_system_prompts"
    SET "systemPrompt" = "systemPrompt" || E'\n\n---\n\n' || r."systemPrompt"
    WHERE "contentType" =
          CASE WHEN r."contentType" LIKE 'prompt\_%' THEN 'prompt_POST' ELSE 'POST' END
      AND "userId"     IS NOT DISTINCT FROM r."userId"
      AND "workspaceId" IS NOT DISTINCT FROM r."workspaceId";

    IF FOUND THEN
      -- Já existia um prompt para o destino: o texto foi fundido, esta linha
      -- é redundante.
      DELETE FROM "ai_system_prompts" WHERE "id" = r."id";
    ELSE
      -- Destino livre: renomeia preservando o prefixo.
      UPDATE "ai_system_prompts"
      SET "contentType" =
        CASE WHEN "contentType" LIKE 'prompt\_%' THEN 'prompt_POST' ELSE 'POST' END
      WHERE "id" = r."id";
    END IF;

    n := n + 1;
  END LOOP;
  RAISE NOTICE 'ai_system_prompts: % prompt(s) fundido(s) em POST/prompt_POST', n;
END $$;

-- 3b) Renomeios 1:1, com guarda de colisão. Se o destino já existir no mesmo
-- âmbito, funde; se não, renomeia. (Fazer um UPDATE cego aqui rebentaria com
-- uma violação de unicidade numa base que tivesse as duas linhas.)
DO $$
DECLARE
  r RECORD;
  n INTEGER := 0;
BEGIN
  FOR r IN
    SELECT "id", "userId", "workspaceId", "systemPrompt", "contentType", "destino"
    FROM (
      SELECT "id", "userId", "workspaceId", "systemPrompt", "contentType",
             'POST' AS "destino"
        FROM "ai_system_prompts" WHERE "contentType" = 'LINKEDIN_POST'
      UNION ALL
      SELECT "id", "userId", "workspaceId", "systemPrompt", "contentType",
             'prompt_POST'
        FROM "ai_system_prompts" WHERE "contentType" = 'prompt_LINKEDIN_POST'
      UNION ALL
      SELECT "id", "userId", "workspaceId", "systemPrompt", "contentType",
             'VIDEO'
        FROM "ai_system_prompts" WHERE "contentType" = 'VIDEO_SCRIPT'
      UNION ALL
      SELECT "id", "userId", "workspaceId", "systemPrompt", "contentType",
             'prompt_VIDEO'
        FROM "ai_system_prompts" WHERE "contentType" = 'prompt_VIDEO_SCRIPT'
    ) pendentes
  LOOP
    UPDATE "ai_system_prompts"
    SET "systemPrompt" = "systemPrompt" || E'\n\n---\n\n' || r."systemPrompt"
    WHERE "contentType" = r."destino"
      AND "userId"     IS NOT DISTINCT FROM r."userId"
      AND "workspaceId" IS NOT DISTINCT FROM r."workspaceId";

    IF FOUND THEN
      DELETE FROM "ai_system_prompts" WHERE "id" = r."id";
    ELSE
      UPDATE "ai_system_prompts" SET "contentType" = r."destino" WHERE "id" = r."id";
    END IF;

    n := n + 1;
  END LOOP;
  RAISE NOTICE 'ai_system_prompts: % prompt(s) renomeado(s) 1:1', n;
END $$;

-- 3c) As chaves antigas já não devem existir. Falha a migration se sobrar
-- alguma — é a prova de que o mapeamento está completo.
DO $$
DECLARE
  restantes TEXT;
BEGIN
  SELECT string_agg("contentType", ', ')
    INTO restantes
    FROM "ai_system_prompts"
   WHERE "contentType" IN (
     'LINKEDIN_POST', 'CTA_POST', 'THREAD', 'VIDEO_SCRIPT', 'INSTAGRAM_POST',
     'prompt_LINKEDIN_POST', 'prompt_CTA_POST', 'prompt_THREAD',
     'prompt_VIDEO_SCRIPT', 'prompt_INSTAGRAM_POST'
   );

  IF restantes IS NOT NULL THEN
    RAISE EXCEPTION
      'ai_system_prompts: chaves antigas por remapear: %', restantes;
  END IF;
END $$;