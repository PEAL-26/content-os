-- Hotfix: plan_items.updatedAt e weekly_plans.updatedAt são NOT NULL sem DEFAULT.
--
-- O `@updatedAt` do Prisma só é aplicado pelo Prisma Client, mas este projecto
-- escreve sempre via Supabase JS client, que o bypassa por completo.
-- O createPlanItem não enviava o campo -> 23502 not-null violation.

ALTER TABLE "plan_items" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "weekly_plans" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;