import type { IncomingMessage, ServerResponse } from 'node:http';
import {
    handleAiGenerate,
    resolveAiApiEnv,
    sendServerMisconfigured,
} from '../../server/ai-api.js';

export const config = {
    runtime: 'nodejs',
    // Alinhado com `vercel.json` (300 = máximo do plano Hobby). O handler tem
    // timeout de 180s, portanto tem de ser >= a isso ou a Vercel mata a função
    // antes do nosso próprio timeout — o utilizador veria 504 sem mensagem.
    maxDuration: 300,
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