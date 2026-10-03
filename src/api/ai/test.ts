import type { IncomingMessage, ServerResponse } from 'node:http';
import {
    handleAiTest,
    resolveAiApiEnv,
    sendServerMisconfigured,
} from '../../server/ai-api.js';

export const config = {
    runtime: 'nodejs',
    // O handler tem timeout de 30s; 60 dá margem sem Mundo a correr mais.
    maxDuration: 60,
};

/**
 * POST /api/ai/test — testa a conexão com um modelo (chave + modelo),
 * server-side. Reutiliza o mesmo handler do middleware de dev do Vite.
 */
export default async function handler(
    req: IncomingMessage,
    res: ServerResponse
): Promise<void> {
    const env = resolveAiApiEnv(process.env);
    if (!env) {
        sendServerMisconfigured(res);
        return;
    }

    await handleAiTest(req, res, env);
}