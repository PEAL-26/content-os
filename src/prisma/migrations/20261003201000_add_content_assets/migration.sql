-- Artefactos multiplos - substituem as colunas assetUrl/assetName em
-- articles/content_pieces/video_scripts, que so permitiam UM artefacto por
-- entidade. Modelo polimorfico, no mesmo padrao de content_publications.
--
-- Summary:
--   1. Novo enum: AssetTargetType.
--   2. Nova tabela: content_assets (N artefactos por entidade).
--      workspaceId -> verificacao de ambito no fetch (RLS esta globalmente
--      desligado neste projeto).
--      mimeType    -> MIME do upload; para links externos / backfill, inferido
--                     da extensao do URL.
--   3. Backfill idempotente dos pares (assetUrl, assetName) existentes.
--
-- A remocao das colunas antigas (assetUrl/assetName) NAO esta aqui: e
-- irreversivel e por isso vive na migration seguinte e separada
-- (20261003201500_drop_asset_columns). Ver o pre-flight la descrito.
--
-- Nota sobre a extensao: a expressao `substring(url from '\.([A-Za-z0-9]+)$')`
-- ancora no ULTIMO ponto e devolve NULL quando o URL nao tem extensao
-- (ou termina em ponto). O `url` gravado e o valor ORIGINAL, com query string e
-- fragmento intactos - so a inferencia do MIME usa a versao limpa.

CREATE TYPE "AssetTargetType" AS ENUM ('ARTICLE', 'PIECE', 'VIDEO_SCRIPT');

CREATE TABLE "content_assets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetType" "AssetTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_assets_workspaceId_idx" ON "content_assets"("workspaceId");
CREATE INDEX "content_assets_targetType_targetId_idx" ON "content_assets"("targetType", "targetId");
CREATE INDEX "content_assets_createdAt_idx" ON "content_assets"("createdAt");


-- ---------------------------------------------------------------------------
-- 3. Backfill. As tres fontes legacy estao unidas num unico statement: assim a
--    limpeza do URL e o mapa de extensao -> MIME existem em UM sitio so (uma
--    das tres copias era o sítio onde um typo se esconderia).
--
--    Idempotente: o NOT EXISTS evita duplicar se a migration for reaplicada. O
--    createdAt original e preservado para a ordem da grelha nao mudar em
--    relacao aos artefactos ja existentes.
--
--    Linhas com assetUrl vazio/so com espacos sao ignoradas: um artefacto com
--    url='' renderizaria <img src="">.
-- ---------------------------------------------------------------------------

WITH legacy AS (
    SELECT
        'ARTICLE'::"AssetTargetType" AS "targetType",
        a."workspaceId" AS "workspaceId",
        a."id" AS "targetId",
        a."assetUrl" AS "url",
        a."assetName" AS "name",
        a."createdAt" AS "createdAt"
    FROM "articles" a
    WHERE a."assetUrl" IS NOT NULL
      AND btrim(a."assetUrl") <> ''

    UNION ALL

    SELECT
        'PIECE',
        p."workspaceId",
        p."id",
        p."assetUrl",
        p."assetName",
        p."createdAt"
    FROM "content_pieces" p
    WHERE p."assetUrl" IS NOT NULL
      AND btrim(p."assetUrl") <> ''

    UNION ALL

    SELECT
        'VIDEO_SCRIPT',
        v."workspaceId",
        v."id",
        v."assetUrl",
        v."assetName",
        v."createdAt"
    FROM "video_scripts" v
    WHERE v."assetUrl" IS NOT NULL
      AND btrim(v."assetUrl") <> ''
),
cleaned AS (
    -- clean_url: URL sem query string e sem fragmento, so para inferir o MIME
    -- (igual a extensionFromUrl() em content-asset.service.ts). O "url" que se
    -- grava continua a ser o valor ORIGINAL, com ? e # intactos.
    SELECT
        l."targetType",
        l."workspaceId",
        l."targetId",
        l."url",
        split_part(split_part(l."url", '?', 1), '#', 1) AS "clean_url",
        l."name",
        l."createdAt"
    FROM legacy l
),
typed AS (
    -- ext: extensao em minusculas, ou NULL quando nao ha extensao.
    SELECT
        c."targetType",
        c."workspaceId",
        c."targetId",
        c."url",
        c."name",
        c."createdAt",
        lower(substring(c."clean_url" from '\.([A-Za-z0-9]+)$')) AS "ext"
    FROM cleaned c
)
INSERT INTO "content_assets" ("id", "workspaceId", "targetType", "targetId", "url", "name", "mimeType", "createdAt")
SELECT
    gen_random_uuid()::text,
    t."workspaceId",
    t."targetType",
    t."targetId",
    t."url",
    t."name",
    CASE t."ext"
        WHEN 'jpg' THEN 'image/jpeg'
        WHEN 'jpeg' THEN 'image/jpeg'
        WHEN 'png' THEN 'image/png'
        WHEN 'gif' THEN 'image/gif'
        WHEN 'webp' THEN 'image/webp'
        WHEN 'svg' THEN 'image/svg+xml'
        WHEN 'avif' THEN 'image/avif'
        WHEN 'heic' THEN 'image/heic'
        WHEN 'mp4' THEN 'video/mp4'
        WHEN 'm4v' THEN 'video/x-m4v'
        WHEN 'webm' THEN 'video/webm'
        WHEN 'mov' THEN 'video/quicktime'
        WHEN 'pdf' THEN 'application/pdf'
        WHEN 'zip' THEN 'application/zip'
        ELSE NULL
    END,
    t."createdAt"
FROM typed t
WHERE NOT EXISTS (
    SELECT 1 FROM "content_assets" ca
    WHERE ca."targetType" = t."targetType"
      AND ca."targetId" = t."targetId"
      AND ca."url" = t."url"
);