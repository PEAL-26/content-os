import type { Connect, Plugin } from 'vite';
import { loadEnv } from 'vite';
import type { AiApiEnv } from './ai-api';
import { handleAiGenerate, handleAiTest } from './ai-api';

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
                // Em dev, se o env do Supabase não estiver presente, segue sem
                // validar (o acesso à BD da app já falha sem essas variáveis,
                // portanto não há risco real de relay).
                skipAuth: !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY,
            };

            const middleware: Connect.NextHandleFunction = (req, res) => {
                const url = req.url ?? '';
                const clean = url.split('?')[0].replace(/\/+$/, '');
                // O Connect (mount '/api/ai') remove o prefixo do req.url dentro
                // do handler — aceitamos as duas formas (com e sem o prefixo)
                // para não depender desse comportamento.
                const isGenerate =
                    clean === '/api/ai/generate' || clean === '/generate';
                const isTest =
                    clean === '/api/ai/test' || clean === '/test';

                if (isGenerate) {
                    void handleAiGenerate(req, res, apiEnv);
                    return;
                }
                if (isTest) {
                    void handleAiTest(req, res, apiEnv);
                    return;
                }
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ ok: false, error: 'Rota API não encontrada.' }));
            };

            server.middlewares.use('/api/ai', middleware);
        },
    };
}