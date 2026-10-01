import 'dotenv/config';
import type { Connect, Plugin } from 'vite';
import { loadEnv } from 'vite';
import type { AiApiEnv } from './ai-api.js';
import { handleAiEnqueue, handleAiGenerate, handleAiTest } from './ai-api.js';
import { handleInngestWithPathCheck } from './generation/inngest.js';

/**
 * Plugin de dev do Vite: regista os handlers /api/ai/* como middleware do dev
 * server, garantindo que `npm run dev` continua a ser apenas `vite` (sem
 * processo extra). Em produção os MESMOS handlers correm nas Vercel Functions
 * `api/ai/*`. A única diferença é como o env é resolvido.
 */
export function apiAiDevPlugin(): Plugin {
    return {
        name: 'contentos-api-ai-dev',
        configureServer(server) {
            const env = loadEnv(server.config.mode, process.cwd(), '');
            const apiEnv: AiApiEnv = {
                supabaseUrl: env.VITE_SUPABASE_URL ?? '',
                supabaseAnonKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
                // Dev local: sem auth (plano — tudo corre localmente, RLS off).
                // Em produção os MESMOS handlers correm nas Vercel Functions
                // `api/ai/*`, onde skipAuth=false e o JWT é validado.
                skipAuth: server.config.mode !== 'production',
            };

            // -------------------------------------------------------------
            // /api/ai/* — generated handlers (same-origin, CORS-free).
            // -------------------------------------------------------------
            const middleware: Connect.NextHandleFunction = (req, res) => {
                const url = req.url ?? '';
                const clean = url.split('?')[0].replace(/\/+$/, '');
                // O Connect (mount '/api/ai') remove o prefixo do req.url dentro
                // do handler — aceitamos as duas formas (com e sem o prefixo)
                // para não depender desse comportamento.
                const isGenerate =
                    clean === '/api/ai/generate' || clean === '/generate';
                const isTest = clean === '/api/ai/test' || clean === '/test';
                const isEnqueue =
                    clean === '/api/ai/enqueue' || clean === '/enqueue';

                if (isGenerate) {
                    void handleAiGenerate(req, res, apiEnv);
                    return;
                }
                if (isTest) {
                    void handleAiTest(req, res, apiEnv);
                    return;
                }
                if (isEnqueue) {
                    void handleAiEnqueue(req, res, apiEnv);
                    return;
                }
                res.statusCode = 404;
                res.setHeader(
                    'Content-Type',
                    'application/json; charset=utf-8'
                );
                res.end(
                    JSON.stringify({
                        ok: false,
                        error: 'Rota API não encontrada.',
                    })
                );
            };

            server.middlewares.use('/api/ai', middleware);

            // -------------------------------------------------------------
            // /api/inngest — endpoint do Inngest (dev). Serve o handler com
            // verificação manual do path (sem mount: o path precisa chegar
            // intacto ao serve para os intents register/sync/send). Rotas
            // fora do path seguem o pipeline normal.
            // -------------------------------------------------------------
            server.middlewares.use((req, res, next: Connect.NextFunction) => {
                if (!isInngestUrl(req.url)) {
                    next();
                    return;
                }
                // Nunca propagar rejeições: um pedido malformado não pode
                // derrubar o dev server (o serve() rejeita em JSON inválido).
                void handleInngestWithPathCheck(req, res).catch(
                    (error: unknown) => {
                        if (res.writableEnded) {
                            res.destroy();
                            return;
                        }
                        const message =
                            error instanceof Error
                                ? error.message
                                : String(error);
                        res.statusCode = 500;
                        res.setHeader(
                            'Content-Type',
                            'application/json; charset=utf-8'
                        );
                        res.end(
                            JSON.stringify({
                                ok: false,
                                error: `Inngest handler error: ${message}`,
                            })
                        );
                    }
                );
            });
        },
    };
}

function isInngestUrl(url: string | undefined): boolean {
    const clean = (url ?? '').split('?')[0].replace(/\/+$/, '');
    return clean === '/api/inngest' || clean.startsWith('/api/inngest/');
}
