import { prisma } from '../src/lib/prisma.js';

// Idempotente: pode correr várias vezes sem efeito colateral.
// 1) Desactiva o provider NVIDIA Inkling (modelo EOL -> HTTP 410 Gone).
//    Mantem-se a linha (e a chave) para historico; so deixa de ser escolhido.
// 2) Marca como FAILED os jobs presos em RUNNING/QUEUED ha mais de 30 min.
//    Eram de geracoes que ficaram penduradas sem timeout; sem isto a UI
//    mostra "a gerar" para sempre.
// O pooler do Supabase fecha ligacoes ociosas; um unico `UPDATE` pode apanhar
// esse reset. Repetir com backoff tornaria o script idempotente e utilizavel
// sem_execucao manual.
async function retry<T>(label: string, fn: () => Promise<T>, tries = 4): Promise<T> {
    let lastErr: unknown;
    for (let i = 1; i <= tries; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (i < tries) {
                const wait = 1500 * i;
                console.warn(`  (${label} falhou, tentativa ${i}/${tries}, a repetir em ${wait}ms)`);
                await new Promise((r) => setTimeout(r, wait));
            }
        }
    }
    throw lastErr;
}

/** Linha de `ai_providers` devolvida pelo UPDATE ... RETURNING. */
interface ProviderRow {
    name: string;
    id: string;
}

/** Linha de `generation_jobs` devolvida pelo UPDATE ... RETURNING. */
interface JobRow {
    jobType: string;
    status: string;
    createdAt: Date;
}

async function main() {
    const inkling = (await retry('desactivar inkling', () =>
        prisma.$queryRawUnsafe(`
        UPDATE ai_providers
           SET "isActive" = false, "updatedAt" = now()
         WHERE "baseUrl" ILIKE '%nvidia%'
           AND EXISTS (
               SELECT 1 FROM ai_provider_models m
                WHERE m."providerId" = ai_providers.id
                  AND m."modelCode" = 'thinkingmachines/inkling'
           )
           AND "isActive" = true
        RETURNING name, id
    `))) as ProviderRow[];

    console.log(`providers desactivados: ${inkling.length}`);
    for (const r of inkling) console.log(`  - ${r.name} (${r.id})`);

    const jobs = (await retry('marcar jobs', () =>
        prisma.$queryRawUnsafe(`
        UPDATE generation_jobs
           SET status = 'FAILED',
               error = 'Geracao abandonada: o job ficou pendurado sem timeout (provider nao respondeu). Volta a gerar.',
               "updatedAt" = now()
         WHERE status IN ('RUNNING', 'QUEUED')
           AND "updatedAt" < now() - interval '30 minutes'
        RETURNING "jobType", status, "createdAt"
    `))) as JobRow[];

    console.log(`\njobs marcados FAILED: ${jobs.length}`);
    for (const j of jobs) {
        console.log(`  - ${j.jobType} (criado ${new Date(j.createdAt).toISOString().slice(0, 16)})`);
    }
}

main()
    .catch((e: unknown) => console.error('ERR', e instanceof Error ? e.message : String(e)))
    .finally(() => prisma.$disconnect());