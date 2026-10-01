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
 */
export const generationFunction = inngest.createFunction(
    {
        id: 'contentos-generation-v1',
        name: 'Geração de conteúdo IA (artigos, peças, roteiros)',
        retries: 2,
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
 * Handler HTTP pronto a servir em `/api/inngest` (RequestListener).
 * O `serve` decide os intents (register/sync/send) e executa as funções.
 */
export const inngestHandler = serve({
    client: inngest,
    functions: [generationFunction],
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