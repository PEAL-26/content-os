-- Scope de IA não pode ser uma string vazia.
--
-- O CHECK anterior exigia apenas `IS NOT NULL`, o que torna `''` um estado
-- válido e — pior — invisível: uma linha com `userId = NULL` e `workspaceId = ''`
-- não pertence a nenhum utilizador nem a nenhum workspace, logo nunca aparece no
-- check de providers do `enqueue` nem em `loadAvailableProviders`, e o job falha
-- com "Nenhum provider de IA configurado" apesar de o provider existir.
--
--   Offensor (2026-10-02, provider customizado "Nvidia"):
--     userId = NULL, workspaceId = ''  -> NO_PROVIDER em todas as gerações
--
-- A string vazia passa a ser rejeitada pela BD. O guard abaixo ABORTA a
-- migração se ainda houver linhas inválidas, em vez de as apagar ou de lhes
-- inventar um dono: quem decide a quem pertence o provider é o utilizador
-- (é um dado de conta, não uma Inferência).
--
-- Nota: `migrate deploy` não é o caminho habitual nesta base (foi criada com
-- `db push`, sem `_prisma_migrations`); o mesmo SQL é aplicado directamente
-- quando necessário.

-- 1. Guard: nenhuma linha pode ter scope vazio (ou os dois a NULL) antes de
--    apertar a constraint.
DO $$
DECLARE
    offenders text;
BEGIN
    SELECT string_agg(format('%s (id=%s)', name, id), ', ')
      INTO offenders
      FROM ai_providers
     WHERE ("userId" IS NOT NULL AND length("userId") = 0)
        OR ("workspaceId" IS NOT NULL AND length("workspaceId") = 0);

    IF offenders IS NOT NULL THEN
        RAISE EXCEPTION
            'ai_providers com scope inválido (string vazia): % — atribui o scope (userId ou workspaceId) antes de esta migração; a migração não adivinha o dono.', offenders;
    END IF;

    SELECT string_agg(format('%s/%s', "contentType", coalesce("userId", "workspaceId")), ', ')
      INTO offenders
      FROM ai_system_prompts
     WHERE ("userId" IS NOT NULL AND length("userId") = 0)
        OR ("workspaceId" IS NOT NULL AND length("workspaceId") = 0);

    IF offenders IS NOT NULL THEN
        RAISE EXCEPTION
            'ai_system_prompts com scope inválido (string vazia): % — atribui o scope antes de esta migração.', offenders;
    END IF;
END $$;

-- 2. Scope válido = exactamente um dono, e esse dono não é vazio.
ALTER TABLE "ai_providers"
    DROP CONSTRAINT IF EXISTS "ai_providers_scope_check";

ALTER TABLE "ai_providers"
    ADD CONSTRAINT "ai_providers_scope_check"
    CHECK (
        (("userId" IS NOT NULL AND length("userId") > 0) AND "workspaceId" IS NULL)
        OR (("userId" IS NULL) AND ("workspaceId" IS NOT NULL AND length("workspaceId") > 0))
    );

ALTER TABLE "ai_system_prompts"
    DROP CONSTRAINT IF EXISTS "ai_system_prompts_scope_check";

ALTER TABLE "ai_system_prompts"
    ADD CONSTRAINT "ai_system_prompts_scope_check"
    CHECK (
        (("userId" IS NOT NULL AND length("userId") > 0) AND "workspaceId" IS NULL)
        OR (("userId" IS NULL) AND ("workspaceId" IS NOT NULL AND length("workspaceId") > 0))
    );
