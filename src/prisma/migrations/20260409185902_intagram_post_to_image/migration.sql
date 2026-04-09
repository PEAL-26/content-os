/*
  Warnings:

  - The values [INSTAGRAM_POST] on the enum `ContentFormat` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ContentFormat_new" AS ENUM ('CAROUSEL', 'SHORT_VIDEO', 'LINKEDIN_POST', 'IMAGE', 'THREAD', 'CTA_POST', 'VIDEO_SCRIPT');
ALTER TABLE "content_pieces" ALTER COLUMN "format" TYPE "ContentFormat_new" USING ("format"::text::"ContentFormat_new");
ALTER TYPE "ContentFormat" RENAME TO "ContentFormat_old";
ALTER TYPE "ContentFormat_new" RENAME TO "ContentFormat";
DROP TYPE "public"."ContentFormat_old";
COMMIT;
