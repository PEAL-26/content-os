import { createOpenAI } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { APICallError, generateText } from 'ai';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';

// =============================================================================
// Handler partilhado das rotas /api/ai/* — corre dentro da Vercel Function em
// produção e como middleware do dev server do Vite em desenvolvimento (mesmo
// código). Resolve o CORS: o browser fala sempre com o próprio servidor
// (same-origin) em vez de chamar os endpoints dos providers diretamente.
// =============================================================================

export interface AiApiEnv {
    supabaseUrl: string;
    supabaseAnonKey: string;
    /** Opcional: desativa a validação do token em dev (parity local). */
    skipAuth?: boolean;
}

// ---------------------------------------------------------------
// Validação com zod (limites explícitos — a chave não é persistida)
// ---------------------------------------------------------------

const generateSchema = z.object({
    baseUrl: z.string().url().max(500),
    apiKey: z.string().min(1).max(4000),
    model: z.string().min(1).max(300),
    system: z.string().max(60000).optional(),
    prompt: z.string().max(60000),
    config: z
        .object({
            temperature: z.number().min(0).max(2).optional(),
            max_tokens: z.number().int().positive().max(200000).optional(),
        })
        .optional(),
    headers: z.record(z.string(), z.string()).optional(),
});

type GenerateBody = z.infer<typeof generateSchema>;

// ---------------------------------------------------------------
// Helpers HTTP
// ---------------------------------------------------------------

async function readBody(req: IncomingMessage, limitBytes = 256 * 1024): Promise<string> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        chunks.push(chunk as Buffer);
        size += (chunk as Buffer).length;
        if (size > limitBytes) {
            throw new Error('Corpo do pedido demasiado grande.');
        }
    }
    return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}

// ---------------------------------------------------------------
// Autenticação — valida o JWT do Supabase no servidor
// ---------------------------------------------------------------

async function verifyAuth(
    req: IncomingMessage,
    env: AiApiEnv
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    if (env.skipAuth) return { ok: true };

    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
        return { ok: false, status: 401, error: 'Sem token de autenticação.' };
    }

    const sb = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) {
        return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
    }
    return { ok: true };
}

// ---------------------------------------------------------------
// Execução LLM (OpenAI-compatible, server-side)
// ---------------------------------------------------------------

async function runGeneration(
    body: GenerateBody,
    defaultMaxTokens: number,
    timeoutMs: number
): Promise<string> {
    const { baseUrl, apiKey, model, system, prompt, config, headers } = body;

    const providerHeaders: Record<string, string> = headers ?? {};

    const openai = createOpenAI({
        baseURL: baseUrl,
        apiKey,
        ...(Object.keys(providerHeaders).length > 0
            ? { headers: providerHeaders }
            : {}),
    });

    const generateOptions: Record<string, unknown> = {};
    if (config?.temperature != null) {
        generateOptions.temperature = config.temperature;
    }

    try {
        const { text } = await generateText({
            model: openai.chat(model),
            ...(system ? { system } : {}),
            prompt,
            maxOutputTokens: config?.max_tokens ?? defaultMaxTokens,
            ...generateOptions,
            timeout: timeoutMs,
        });

        return text;
    } catch (err) {
        // Erros HTTP do provider (ex.: 404 Not Found, 401 Unauthorized) chegam
        // como APICallError — incluir o status para o utilizador perceber a causa.
        if (err instanceof APICallError) {
            const status = err.statusCode ?? '?';
            throw new Error(
                `O provider respondeu com erro ${status}${err.message ? `: ${err.message}` : ''}`
            );
        }
        throw err;
    }
}

// ---------------------------------------------------------------
// Rota /api/ai/generate
// ---------------------------------------------------------------

export async function handleAiGenerate(
    req: IncomingMessage,
    res: ServerResponse,
    env: AiApiEnv
): Promise<void> {
    let bodyText = '';
    try {
        bodyText = await readBody(req);
    } catch (err) {
        sendJson(res, 413, {
            ok: false,
            error: err instanceof Error ? err.message : 'Corpo do pedido inválido.',
            code: 'BODY_TOO_LARGE',
        });
        return;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(bodyText);
    } catch {
        sendJson(res, 400, { ok: false, error: 'JSON inválido no corpo do pedido.', code: 'INVALID_JSON' });
        return;
    }

    const validation = generateSchema.safeParse(parsed);
    if (!validation.success) {
        sendJson(res, 400, {
            ok: false,
            error: 'Parâmetros inválidos: ' + validation.error.issues[0]?.message,
            code: 'VALIDATION_ERROR',
        });
        return;
    }

    const auth = await verifyAuth(req, env);
    if (!auth.ok) {
        sendJson(res, auth.status, { ok: false, error: auth.error, code: 'UNAUTHORIZED' });
        return;
    }

    try {
        const text = await runGeneration(validation.data, 8000, 120_000);
        sendJson(res, 200, { ok: true, text });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido ao gerar.';
        console.warn('[api/ai/generate] falhou:', message);
        sendJson(res, 502, {
            ok: false,
            error: message,
            code: 'PROVIDER_ERROR',
        });
    }
}

// ---------------------------------------------------------------
// Rota /api/ai/test — teste de conexão por modelo (prompt mínimo)
// ---------------------------------------------------------------

const testSchema = z.object({
    baseUrl: z.string().url().max(500),
    apiKey: z.string().min(1).max(4000),
    model: z.string().min(1).max(300),
    headers: z.record(z.string(), z.string()).optional(),
});

export async function handleAiTest(
    req: IncomingMessage,
    res: ServerResponse,
    env: AiApiEnv
): Promise<void> {
    let bodyText = '';
    try {
        bodyText = await readBody(req, 64 * 1024);
    } catch (err) {
        sendJson(res, 413, {
            ok: false,
            error: err instanceof Error ? err.message : 'Corpo do pedido inválido.',
            code: 'BODY_TOO_LARGE',
        });
        return;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(bodyText);
    } catch {
        sendJson(res, 400, { ok: false, error: 'JSON inválido no corpo do pedido.', code: 'INVALID_JSON' });
        return;
    }

    const validation = testSchema.safeParse(parsed);
    if (!validation.success) {
        sendJson(res, 400, {
            ok: false,
            error: 'Parâmetros inválidos: ' + validation.error.issues[0]?.message,
            code: 'VALIDATION_ERROR',
        });
        return;
    }

    const auth = await verifyAuth(req, env);
    if (!auth.ok) {
        sendJson(res, auth.status, { ok: false, error: auth.error, code: 'UNAUTHORIZED' });
        return;
    }

    try {
        const text = await runGeneration(
            { ...validation.data, prompt: 'Responde apenas com: OK', config: { max_tokens: 16 } },
            16,
            30_000
        );
        sendJson(res, 200, { ok: true, text });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido ao testar.';
        console.warn('[api/ai/test] falhou:', message);
        sendJson(res, 502, {
            ok: false,
            error: message,
            code: 'PROVIDER_ERROR',
        });
    }
}