import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAiEnqueue } from '../../server/ai-api.js';

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
    const env = {
        supabaseUrl: process.env.VITE_SUPABASE_URL ?? '',
        supabaseAnonKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
        skipAuth:
            !process.env.VITE_SUPABASE_URL ||
            !process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };

    await handleAiEnqueue(req, res, env);
}