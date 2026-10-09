import type { ServerResponse } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { Inngest } from 'inngest';
import { serve } from 'inngest/node';
import { runGenerationJob } from './orchestration.js';

// =============================================================================
// Inngest — cliente + função de geração + handler HTTP (`/api/inngest`).
// Dev local: `INNGEST_DEV=1` (já no .env) encaminha tudo para o dev server
// (`npm run dev:inngest`, porta 8288).
// =============================================================================

export const GENERATION_EVENT = 'contentos/generation.requested';

export const inngest = new Inngest({
    id: 'contentos',
    ...(process.env.INNGEST_EVENT_KEY
        ? { eventKey: process.env.INNGEST_EVENT_KEY }
        : {}),
    ...(process.env.INNGEST_SIGNING_KEY
        ? { signingKey: process.env.INNGEST_SIGNING_KEY }
        : {}),
});

/** Envia o evento que dispara a geração do job. */
export function sendGenerationRequested(jobId: string): Promise<unknown> {
    return inngest.send({
        name: GENERATION_EVENT,
        data: { jobId },
    });
}

/** Verifica se um pedido HTTP pertence ao endpoint Inngest. */
export function isInngestRequest(url: string | undefined): boolean {
    const path = (url ?? '').split('?')[0];
    return path === '/api/inngest' || path.startsWith('/api/inngest/');
}

/**
 * Handler do job. Guarda idempotente: jobs já concluídos não re-correm.
 * Falhas inesperadas propagam para o retry do Inngest (retries: 2).
 *
 * `timeouts.start` é obrigatório, não cosmético: sem ele um job que fica
 * pendurado (provider que nunca responde, geração sem fim) fica em RUNNING
 * para sempre — havia jobs com 7+ horas em RUNNING. O deadline converte o
 * travado em retry, e o retry acaba em FAILED visível no job.
 *
 * `concurrency: 2` limita quantos jobs correm ao mesmo tempo. O plano free da
 * NVIDIA degrada com concorrência (medido: 3 pedidos em paralelo → 73s/96s/127s
 * para a mesma peça), por isso 2 em vez de 3. Dentro de um job, o
 * `pLimit(3)` de `orchestration.ts` continua a paralelizar as peças.
 */
export const generationFunction = inngest.createFunction(
    {
        id: 'contentos-generation-v1',
        name: 'Geração de conteúdo IA (artigos, peças, roteiros)',
        retries: 2,
        concurrency: 2,
        timeouts: { start: '15m' },
        triggers: [{ event: GENERATION_EVENT }],
    },
    async ({ event, runId }) => {
        const jobId = (event.data as { jobId?: unknown }).jobId as
            | string
            | undefined;
        if (!jobId) {
            throw new Error('Evento sem jobId.');
        }
        await runGenerationJob(jobId, runId);
        return { ok: true, jobId };
    }
);

/**
 * EVENTO DE MEDIA — separado do de texto, e com um timeout maior.
 *
 * ⚠️ R3 do plano: `veo-3` faz polling durante vários minutos, e um short de 30s
 * pode passar dos 15 min do `generationFunction`. Com o timeout partilhado, um
 * vídeo acabava em FAILED com o ficheiro já gerado e pago.
 *
 * Por isso há um evento e uma função próprios:
 *   · `timeouts.start: 25m` dá espaço ao polling do Veo;
 *   · `concurrency: 1` — as chamadas de media são pagas (~$0,75/seg de vídeo) e
 *     não devem correr em paralelo.
 *
 * `MEDIA_PROMPT` também passa por aqui apesar de ser só texto: fica isolado do
 * `concurrency: 2`, que está calibrado para o plano free do provider de texto.
 */
export const MEDIA_EVENT = 'contentos/media.requested';

/** Envia o evento que dispara um job de media. */
export function sendMediaRequested(jobId: string): Promise<unknown> {
    return inngest.send({
        name: MEDIA_EVENT,
        data: { jobId },
    });
}

export const mediaFunction = inngest.createFunction(
    {
        id: 'contentos-media-v1',
        name: 'Media IA (prompts de media, imagem, áudio, vídeo)',
        retries: 1,
        concurrency: 1,
        timeouts: { start: '25m' },
        triggers: [{ event: MEDIA_EVENT }],
    },
    async ({ event, runId }) => {
        const jobId = (event.data as { jobId?: unknown }).jobId as
            | string
            | undefined;
        if (!jobId) {
            throw new Error('Evento de media sem jobId.');
        }
        await runGenerationJob(jobId, runId);
        return { ok: true, jobId };
    }
);

/**
 * Handler HTTP pronto a servir em `/api/inngest` (RequestListener).
 * O `serve` decide os intents (register/sync/send) e executa as funções.
 */
export const inngestHandler = serve({
    client: inngest,
    functions: [generationFunction, mediaFunction],
});

// -----------------------------------------------------------------------------
// Adaptador para middleware Connect (Vite) — só é chamado em /api/inngest
// (o plugin do Vite faz a verificação do path antes de invocar).
// -----------------------------------------------------------------------------

export function handleInngestWithPathCheck(
    req: IncomingMessage,
    res: ServerResponse
): Promise<void> {
    if (!isInngestRequest(req.url)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Not found' }));
        return Promise.resolve();
    }
    return Promise.resolve(inngestHandler(req, res));
}