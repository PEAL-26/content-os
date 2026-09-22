import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAiTest } from '../../server/ai-api';

export const config = {
    runtime: 'nodejs',
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

    await handleAiTest(req, res, env);
}