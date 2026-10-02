-- Tabela de configuração dos dias de planeamento (uma linha por dia da semana).

CREATE TABLE "planning_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "suggestedPillarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planning_configs_dayOfWeek_range" CHECK ("dayOfWeek" BETWEEN 1 AND 7)
);

CREATE UNIQUE INDEX "planning_configs_workspaceId_dayOfWeek_key"
    ON "planning_configs"("workspaceId", "dayOfWeek");

ALTER TABLE "planning_configs"
    ADD CONSTRAINT "planning_configs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "planning_configs"
    ADD CONSTRAINT "planning_configs_suggestedPillarId_fkey"
    FOREIGN KEY ("suggestedPillarId") REFERENCES "pillar_configs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: 7 linhas por workspace existente, todas activas.
--
-- O template documentado (README.md:78) é Segunda=P1, Quarta=P2, Sexta=P3.
-- Os restantes dias ficam activos mas sem pilar sugerido — a decisão #3 do
-- plano é liberdade total desde o primeiro clique, com o template a servir
-- de default editável em vez de restrição.
--
-- suggestedPillarId tem de ser resolvido por JOIN a pillar_configs porque é
-- por workspace e pode não existir (pilares customizados). O LEFT JOIN com
-- NULL nos dias 2/4/6/7 é propositado: `p."pillar" = NULL` nunca é verdadeiro,
-- logo dá suggestedPillarId NULL, que não viola a FK.
WITH dias(dia, pilar) AS (
    VALUES
        (1, 'P1_EDUCATION'::"ContentPillar"),
        (2, NULL),
        (3, 'P2_USE_CASES'::"ContentPillar"),
        (4, NULL),
        (5, 'P3_CONVERSION'::"ContentPillar"),
        (6, NULL),
        (7, NULL)
)
INSERT INTO "planning_configs" (
    "id", "workspaceId", "dayOfWeek", "isActive", "suggestedPillarId",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    w."id",
    d.dia,
    true,
    p."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN dias d
LEFT JOIN "pillar_configs" p
    ON p."workspaceId" = w."id" AND p."pillar" = d.pilar
ON CONFLICT ("workspaceId", "dayOfWeek") DO NOTHING;