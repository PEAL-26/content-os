import type { IncomingMessage, ServerResponse } from 'node:http';
import { inngestHandler } from '../server/generation/inngest.js';

export const config = {
    runtime: 'nodejs',
    maxDuration: 60,
};

/**
 * GET/POST/PUT /api/inngest — endpoint padrão do Inngest: recebe os intents
 * de handshake (register/sync), acusa os eventos enviados pelo client e
 * executa as funções de geração. Reutiliza o mesmo handler do dev server.
 *
 * O `serve()` do SDK devolve um RequestListener Node; a Vercel Function
 * (api/*.ts) é um par (req, res) compatível, por isso basta delegar.
 */
export default async function handler(
    req: IncomingMessage,
    res: ServerResponse
): Promise<void> {
    try {
        await inngestHandler(req, res);
    } catch (error) {
        if (res.writableEnded) {
            res.destroy();
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
            JSON.stringify({
                ok: false,
                error: `Inngest handler error: ${message}`,
            })
        );
    }
}
