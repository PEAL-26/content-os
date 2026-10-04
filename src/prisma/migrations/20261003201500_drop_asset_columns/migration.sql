-- Remocao das colunas legacy assetUrl/assetName de
-- articles/content_pieces/video_scripts, depois de backfilladas para
-- content_assets em 20261003201000_add_content_assets.
--
-- PORQUEM ESTA MIGRATION ESTA SEPARADA
-- O DROP COLUMN e IRREVERSIVEL: uma vez executado, os dados das colunas
-- antigas so voltam a partir de um dump. Se estivesse no mesmo ficheiro do
-- CREATE TABLE + backfill, um qualquer erro a meio deixaria o ficheiro numa
-- versao que nem se pode reaplicar nem desfacer com seguranca (o Prisma guarda
-- a migration como aplicada). Separado, o backfill fica verificado e
-- auditavel ANTES de se perder a fonte.
--
-- PRE-FLIGHT (correr depois de 20261003201000 e ANTES desta migration)
-- Comparar o que foi migrado com o que existia:
--
--   SELECT "targetType", count(*) FROM content_assets GROUP BY 1 ORDER BY 1;
--
-- com as contagens legacy (por tabela, assetUrl nao vazia):
--
--   SELECT 'ARTICLE' AS src, count(*) FROM articles
--    WHERE "assetUrl" IS NOT NULL AND btrim("assetUrl") <> ''
--   UNION ALL
--   SELECT 'PIECE', count(*) FROM content_pieces
--    WHERE "assetUrl" IS NOT NULL AND btrim("assetUrl") <> ''
--   UNION ALL
--   SELECT 'VIDEO_SCRIPT', count(*) FROM video_scripts
--    WHERE "assetUrl" IS NOT NULL AND btrim("assetUrl") <> '';
--
-- Os numeros tem de bater. Uma diferenca significa backfill incompleto:
-- NAO aplicar esta migration.
--
-- IF EXISTS em todas as colunas: torna a migration re-executavel sem erro em
-- bases onde a coluna ja nao existe (ex.: aplicadas manualmente antes).

ALTER TABLE "articles"        DROP COLUMN IF EXISTS "assetUrl", DROP COLUMN IF EXISTS "assetName";
ALTER TABLE "content_pieces"  DROP COLUMN IF EXISTS "assetUrl", DROP COLUMN IF EXISTS "assetName";
ALTER TABLE "video_scripts"   DROP COLUMN IF EXISTS "assetUrl", DROP COLUMN IF EXISTS "assetName";