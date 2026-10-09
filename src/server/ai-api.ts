import { createOpenAI } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { APICallError, generateText } from 'ai';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { describePool } from '../src/lib/prisma.js';
import { enqueueGeneration, EnqueueError } from './generation/enqueue.js';
import {
    sendGenerationRequested,
    sendMediaRequested,
} from './generation/inngest.js';
import { markJobFailed } from './generation/job-store.js';

// =============================================================================
// Handler partilhado das rotas /api/ai/* — corre dentro da Vercel Function em
// produção e como middleware do dev server do Vite em desenvolvimento (mesmo
// código). Resolve o CORS: o browser fala sempre com o próprio servidor
// (same-origin) em vez de chamar os endpoints dos providers diretamente.
// =============================================================================

export interface AiApiEnv {
    supabaseUrl: string;
    supabaseAnonKey: string;
    /**
     * Só para o dev server do Vite (paridade local, RLS desligado). Numa
     * Vercel Function isto é SEMPRE `false`: um endpoint de criação de jobs
     * aberto porque falta uma env var seria pior do que estar em baixo.
     */
    skipAuth?: boolean;
}

/** Fonte de env das Vercel Functions (`process.env`) e do plugin do Vite. */
export type AiApiEnvSource = Record<string, string | undefined>;

/**
 * Resolve o `AiApiEnv` das Vercel Functions a partir do `process.env`.
 *
 * Auth: nunca deriva `skipAuth` da ausência de configuração. Env em falta dá
 * `null` e o caller responde `500 SERVER_MISCONFIGURED` — o `enqueue` usava
 * fazer o contrário (`skipAuth: !env...`), o que desligava a autenticação
 * silenciosamente. `skipAuth` é passado à mão e só o dev o usa.
 *
 * Os nomes canónicos são sem `VITE_` (são lidos no servidor). O prefixo `VITE_`
 * existe para injectar valores no bundle do browser; aceitamos ambos, por
 * causa de deployments e `.env` já configurados só com `VITE_*`. A URL do
 * projecto e a anon key não são segredos, por isso o fallback é seguro.
 */
export function resolveAiApiEnv(source: AiApiEnvSource): AiApiEnv | null {
    const supabaseUrl = source.SUPABASE_URL ?? source.VITE_SUPABASE_URL ?? '';
    const supabaseAnonKey =
        source.SUPABASE_PUBLISHABLE_KEY ??
        source.SUPABASE_ANON_KEY ??
        source.VITE_SUPABASE_PUBLISHABLE_KEY ??
        source.VITE_SUPABASE_ANON_KEY ??
        '';

    if (!supabaseUrl || !supabaseAnonKey) return null;
    return { supabaseUrl, supabaseAnonKey };
}

/**
 * Resposta para env em falta. Envolvida num try/catch pelo mesmo motivo do
 * `handleAiEnqueue`: um `throw` de topo de módulo na Vercel devolve um
 * FUNCTION_INVOCATION_FAILED sem corpo JSON, e a UI perde a mensagem.
 */
export function sendServerMisconfigured(res: ServerResponse): void {
    sendJson(res, 500, {
        ok: false,
        error: 'SUPABASE_URL/SUPABASE_ANON_KEY não configurados no servidor.',
        code: 'SERVER_MISCONFIGURED',
    });
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

/**
 * Valida o JWT e devolve o `userId` — que não é decoração: o `enqueue` grava-o
 * no job e é ele que dá ao runtime (`loadGenerationContext(workspaceId,
 * userId)`) visibilidade sobre os providers **do utilizador**, que é onde vivem
 * os providers criados em Definições de IA. Sem isto, qualquer provider de
 * nível de utilizador era invisível e o enqueue respondia NO_PROVIDER.
 *
 * `skipAuth` (dev server do Vite) só relaxa a *rejeição*: o token continua a ser
 * lido quando existe, para o `userId` resolver-se. Curto-circuitar antes de
 * ler o token fazia o job nascer com `userId = null` e o NO_PROVIDER voltava
 * (por providers de utilizador) mesmo depois de o bug estar corrigido.
 */
export async function verifyAuth(
    req: IncomingMessage,
    env: AiApiEnv
): Promise<
    | { ok: true; userId: string | null }
    | { ok: false; status: number; error: string }
> {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
        return env.skipAuth
            ? { ok: true, userId: null }
            : { ok: false, status: 401, error: 'Sem token de autenticação.' };
    }

    const sb = createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) {
        // Em dev não rebentamos o pedido (o modo POC aceita tokens velhos),
        // mas também não inventamos um userId.
        if (env.skipAuth) return { ok: true, userId: null };
        return { ok: false, status: 401, error: 'Sessão inválida ou expirada.' };
    }
    return { ok: true, userId: data.user.id };
}

// ---------------------------------------------------------------
// Execução LLM (OpenAI-compatible, server-side)
// ---------------------------------------------------------------

async function runGeneration(
    body: GenerateBody,
    defaultMaxTokens: number | undefined,
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

    // Só envia `max_tokens` quando existe um tecto (ver nota em
    // `server/generation/transport.ts`): é tecto de RESPOSTA, não de contexto,
    // e omiti-lo devolve a geração completa (`finish_reason: stop`).
    const maxOutputTokens = config?.max_tokens ?? defaultMaxTokens;
    if (maxOutputTokens != null) {
        generateOptions.maxOutputTokens = maxOutputTokens;
    }

    try {
        const { text, finishReason } = await generateText({
            model: openai.chat(model),
            ...(system ? { system } : {}),
            prompt,
            ...generateOptions,
            timeout: timeoutMs,
        });

        if (finishReason === 'length') {
            console.warn(
                `[api/ai] ${model} truncou a resposta (finish=length, max_tokens=${maxOutputTokens}).`
            );
        }

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
        // Sem tecto de tokens por defeito: o provider usa o limite do modelo e
        // o conteúdo não é truncado. O `timeout` é o tecto de segurança.
        const text = await runGeneration(validation.data, undefined, 180_000);
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
        // Sem `max_tokens`: num modelo de RACIOCÍNIO um tecto pequeno é
        // totalmente consumido pelo raciocínio e o `content` sai vazio — o
        // teste de conexão falhava mesmo com o modelo a funcionar (foi
        // `max_tokens: 16` + `z-ai/glm-5.3-flash` a dar `finish: length`,
        // `contentLen: 0`). O `timeout` de 30s é o tecto de segurança.
        const text = await runGeneration(
            { ...validation.data, prompt: 'Responde apenas com: OK', config: undefined },
            undefined,
            30_000
        );
        if (!text.trim()) {
            throw new Error(
                'O provider respondeu sem texto. Pode ser um tecto de tokens baixo ou um modelo que devolveu apenas raciocínio.'
            );
        }
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

// ---------------------------------------------------------------
// Rota /api/ai/enqueue — cria o job + placeholders e dispara o Inngest.
// O browser responde logo (navega para o alvo) e recebe o estado via
// Realtime; a geração corre em segundo plano no handler Inngest.
// ---------------------------------------------------------------

const enqueuePreferredSchema = z
    .object({
        providerId: z.string().max(200).nullable().optional(),
        modelCode: z.string().max(300).nullable().optional(),
    })
    .nullable()
    .optional();

const newArticleEnqueueParamsSchema = z.object({
    topic: z
        .string()
        .trim()
        .min(3, 'O tema do artigo é demasiado curto.')
        .max(1000),
    pillarId: z.string().min(1).max(100).nullable().optional(),
    productId: z.string().min(1).max(100).nullable().optional(),
    additionalInstructions: z.string().max(60000).optional(),
    preferred: enqueuePreferredSchema,
});

const contentFormatSchema = z.string().min(1).max(50);

/** Um canal do workspace (id de `channel_configs.id`), no máximo 10. */
const channelIdsSchema = z.array(z.string().min(1).max(100)).max(10);

/** Modalidade de media: só as três que o registry conhece. */
const mediaModalitySchema = z.enum(['image', 'audio', 'video']);

const contentPiecesEnqueueParamsSchema = z.object({
    articleId: z.string().min(1).max(100),
    formats: z
        .array(contentFormatSchema)
        .min(1, 'Seleciona pelo menos um formato.')
        .max(5),
    /**
     * Canais destino, como LISTA. A geração é o produto cartesiano de canais ×
     * tipos; antes era um canal por tipo, o que impedia pedir POST para LinkedIn
     * e POST para Instagram na mesma corrida.
     */
    channelIds: channelIdsSchema,
    productId: z.string().min(1).max(100).nullable().optional(),
    pillarId: z.string().min(1).max(100).nullable().optional(),
    additionalInstructions: z.string().max(60000).optional(),
    /** Usa o prompt gravado da peça em vez do contexto automático. */
    useStoredPrompt: z.boolean().optional(),
    /** Modalidades cujos PROMPTS de media são gerados automaticamente. */
    modalities: z.array(mediaModalitySchema).max(3).optional(),
    preferred: enqueuePreferredSchema,
});

const contentPromptEnqueueParamsSchema = z.object({
    articleId: z.string().min(1).max(100),
    formats: z
        .array(contentFormatSchema)
        .min(1, 'Seleciona pelo menos um formato.')
        .max(5),
    channelIds: channelIdsSchema,
    productId: z.string().min(1).max(100).nullable().optional(),
    pillarId: z.string().min(1).max(100).nullable().optional(),
    additionalInstructions: z.string().max(60000).optional(),
    preferred: enqueuePreferredSchema,
});

const contentItemEnqueueParamsSchema = z.object({
    pieceId: z.string().min(1).max(100),
    itemKey: z
        .string()
        .trim()
        .min(2)
        .max(40)
        .regex(
            /^(main|slide-\d+|scene-\d+|ilustracao-\d+)$/,
            'itemKey inválido.'
        ),
    /** Regenera também o prompt de media do item (não o artefacto). */
    regenerateMediaPrompt: z.boolean().optional(),
    /**
     * Regenera também o FICHEIRO (Decisão 30). É uma chamada paga — o
     * cliente só liga isto quando o utilizador pediu explicitamente.
     */
    regenerateArtifact: z.boolean().optional(),
    preferred: enqueuePreferredSchema,
});

/**
 * MEDIA_PROMPT — escreve os prompts portáteis de imagem/áudio/vídeo.
 *
 * Corre automaticamente depois de a peça existir (é barato), por isso o
 * `targetId` aponta para o artigo OU para a peça, nunca para um artefacto.
 */
const mediaPromptEnqueueParamsSchema = z.object({
    targetId: z.string().min(1).max(100),
    targetType: z.enum(['ARTICLE', 'PIECE']),
    modalities: z
        .array(mediaModalitySchema)
        .min(1, 'Seleciona pelo menos uma modalidade.')
        .max(3),
    overwrite: z.boolean().optional(),
    preferred: enqueuePreferredSchema,
});

/**
 * MEDIA_ARTIFACT — gera o FICHEIRO. Só chega aqui depois de confirmação com o
 * custo estimado à vista (Decisão 27), e a linha em `content_assets` já existe
 * em PENDING — o que impede um duplo clique de enfileirar dois jobs.
 */
const mediaArtifactEnqueueParamsSchema = z.object({
    mediaPromptId: z.string().min(1).max(100),
    assetId: z.string().min(1).max(100),
    providerTechnicalId: z.string().max(200).nullable().optional(),
    modelCode: z.string().max(300).nullable().optional(),
});

/** Campos de metadados do artigo (espelha METADATA_FIELDS no núcleo puro). */
const metadataFieldSchema = z.enum([
    'summary',
    'keywords',
    'seoTitle',
    'seoDescription',
]);

/**
 * ARTICLE_METADATA — `fields` com `.min(1)` é o que garante que um job sem
 * campos nunca chega ao Inngest (a UI desactiva "Gerar em falta" em N=0, mas o
 * servidor recusa na mesma). `max(4)` trava o pedido arbitrário.
 */
const articleMetadataEnqueueParamsSchema = z.object({
    articleId: z.string().min(1).max(100),
    fields: z
        .array(metadataFieldSchema)
        .min(1, 'Indica pelo menos um metadado a gerar.')
        .max(4),
    additionalInstructions: z.string().max(60000).optional(),
    preferred: enqueuePreferredSchema,
});

const enqueueSchema = z.object({
    jobType: z.enum([
        'NEW_ARTICLE',
        'CONTENT_PIECES',
        'CONTENT_PROMPT',
        'CONTENT_ITEM',
        'ARTICLE_METADATA',
        'MEDIA_PROMPT',
        'MEDIA_ARTIFACT',
    ]),
    workspaceId: z.string().min(1).max(100),
    params: z.unknown(),
    targets: z
        .array(
            z.object({
                format: z.string().min(1).max(50),
                targetId: z.string().min(1).max(100),
                /** NEW_VERSION clona a peça em vez de regenerar por cima. */
                mode: z.enum(['FILL', 'NEW_VERSION']).optional(),
            })
        )
        .max(60)
        .optional(),
});

const enqueueParamsSchemas = {
    NEW_ARTICLE: newArticleEnqueueParamsSchema,
    CONTENT_PIECES: contentPiecesEnqueueParamsSchema,
    CONTENT_PROMPT: contentPromptEnqueueParamsSchema,
    CONTENT_ITEM: contentItemEnqueueParamsSchema,
    ARTICLE_METADATA: articleMetadataEnqueueParamsSchema,
    MEDIA_PROMPT: mediaPromptEnqueueParamsSchema,
    MEDIA_ARTIFACT: mediaArtifactEnqueueParamsSchema,
} as const;

/**
 * Saturação de ligações / timeouts de rede. O `enqueue` já tentou 3 vezes com
 * backoff, portanto se chega aqui com um destes é persistente e vale a pena
 * traduzir para o utilizador em vez de mostrar a mensagem crua do driver.
 */
function isDatabaseBusyError(err: unknown): boolean {
    const code = (err as { code?: unknown } | null)?.code;
    // P2028 = "Unable to start a transaction in the given time" (o erro reportado)
    if (code === 'P2024' || code === 'P1008' || code === 'P2028' || code === 'P2010') {
        return true;
    }

    const message = err instanceof Error ? err.message : String(err);
    return (
        /Transaction API error/i.test(message) ||
        /Unable to start a transaction/i.test(message) ||
        /timed out fetching a new connection/i.test(message) ||
        /EMAXCONNSESSION/i.test(message) ||
        /too many clients/i.test(message) ||
        /timeout expired/i.test(message) ||
        /ConnectionClosed|Server has closed the connection/i.test(message) ||
        /Connection terminated/i.test(message)
    );
}

export async function handleAiEnqueue(
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

    const envelope = enqueueSchema.safeParse(parsed);
    if (!envelope.success) {
        sendJson(res, 400, {
            ok: false,
            error: 'Parâmetros inválidos: ' + envelope.error.issues[0]?.message,
            code: 'VALIDATION_ERROR',
        });
        return;
    }

    const paramsSchema = enqueueParamsSchemas[envelope.data.jobType];
    const paramsValidation = paramsSchema.safeParse(envelope.data.params);
    if (!paramsValidation.success) {
        sendJson(res, 400, {
            ok: false,
            error: 'Parâmetros inválidos: ' + paramsValidation.error.issues[0]?.message,
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
        const created = await enqueueGeneration({
            jobType: envelope.data.jobType,
            workspaceId: envelope.data.workspaceId,
            // Sem isto o job nascia com `userId = null` e nem a validação de
            // providers nem o runtime viam os providers do utilizador.
            userId: auth.userId,
            params: paramsValidation.data,
            targets: envelope.data.targets,
        });

        try {
            // Os jobs de media vão para o evento delas (timeout de 25 min e
            // concorrência 1) — o `veo-3` precisa do tempo e o custo não
            // tolera paralelismo (R3 do plano).
            if (
                envelope.data.jobType === 'MEDIA_PROMPT' ||
                envelope.data.jobType === 'MEDIA_ARTIFACT'
            ) {
                await sendMediaRequested(created.jobId);
            } else {
                await sendGenerationRequested(created.jobId);
            }
        } catch (queueErr) {
            const message =
                queueErr instanceof Error
                    ? `Falha ao enviar para a fila de geração: ${queueErr.message}`
                    : 'Falha ao enviar para a fila de geração.';
            console.warn('[api/ai/enqueue] evento falhou:', message);
            await markJobFailed(created.jobId, message);
            sendJson(res, 502, {
                ok: false,
                error: message,
                code: 'QUEUE_ERROR',
                jobId: created.jobId,
                targetId: created.targetId,
            });
            return;
        }

        sendJson(res, 200, {
            ok: true,
            jobId: created.jobId,
            targetId: created.targetId,
        });
    } catch (err) {
        if (err instanceof EnqueueError) {
            const status = err.code.endsWith('_NOT_FOUND') ? 404 : 400;
            sendJson(res, status, {
                ok: false,
                error: err.message,
                code: err.code,
            });
            return;
        }

        const message =
            err instanceof Error ? err.message : 'Erro desconhecido ao criar a geração.';

        // Base de dados ocupada/sem resposta: o `enqueue` já tentou 3 vezes com
        // backoff, logo a partir daqui é saturação persistente. Devolvemos 503
        // com texto accionável em vez de despejar "Transaction API error…" no UI.
        if (isDatabaseBusyError(err)) {
            console.error(
                '[api/ai/enqueue] base de dados ocupada:',
                message,
                '| pool:',
                JSON.stringify(describePool())
            );
            sendJson(res, 503, {
                ok: false,
                error: 'A base de dados está ocupada. Tenta novamente dentro de segundos.',
                code: 'DB_BUSY',
            });
            return;
        }

        console.error('[api/ai/enqueue] falhou:', message);
        sendJson(res, 500, {
            ok: false,
            error: message,
            code: 'INTERNAL_ERROR',
        });
    }
}