import type { IncomingMessage, ServerResponse } from 'node:http';
import {
    handleAiGenerate,
    resolveAiApiEnv,
    sendServerMisconfigured,
} from '../../server/ai-api.js';

export const config = {
    runtime: 'nodejs',
    maxDuration: 120,
};

/**
 * POST /api/ai/generate — gera texto via um provider OpenAI-compatible,
 * server-side (resolve o CORS das chamadas diretas do browser).
 * Reutiliza o mesmo handler do middleware de dev do Vite.
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

    await handleAiGenerate(req, res, env);
}