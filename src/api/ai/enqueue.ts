import type { IncomingMessage, ServerResponse } from 'node:http';
import {
    handleAiEnqueue,
    resolveAiApiEnv,
    sendServerMisconfigured,
} from '../../server/ai-api.js';

export const config = {
    runtime: 'nodejs',
    maxDuration: 30,
};

/**
 * POST /api/ai/enqueue — cria um job de geração (placeholders + fila Inngest)
 * e devolve { jobId, targetId } para a UI navegar e subscrever o estado.
 * (POC local: a execução em segundo plano só corre com o Inngest dev a par do
 * `vite`; fora de âmbito para produção.)
 */
export default async function handler(
    req: IncomingMessage,
    res: ServerResponse
): Promise<void> {
    // `skipAuth` fica a false (o default) — a autenticação é validada sempre.
    const env = resolveAiApiEnv(process.env);
    if (!env) {
        sendServerMisconfigured(res);
        return;
    }

    await handleAiEnqueue(req, res, env);
}