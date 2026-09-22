import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAiGenerate } from '../../server/ai-api';

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
    const env = {
        supabaseUrl: process.env.SUPABASE_URL ?? '',
        supabaseAnonKey:
            process.env.SUPABASE_PUBLISHABLE_KEY ??
            process.env.SUPABASE_ANON_KEY ??
            '',
    };

    if (!env.supabaseUrl || !env.supabaseAnonKey) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
            JSON.stringify({
                ok: false,
                error: 'SUPABASE_URL/SUPABASE_ANON_KEY não configurados no servidor.',
                code: 'SERVER_MISCONFIGURED',
            })
        );
        return;
    }

    await handleAiGenerate(req, res, env);
}