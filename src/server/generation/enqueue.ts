import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/lib/prisma.js';
import { Prisma } from '../../src/generated/prisma/client.js';
import type {
    ContentFormat,
    ContentPillar,
    SocialChannel,
} from '../../src/types/database.js';
import type {
    ContentItemJobParams,
    ContentPiecesJobParams,
    GenerationJobItem,
    GenerationJobParams,
    GenerationJobTypeValue,
    NewArticleJobParams,
    TargetMode,
    VideoScriptJobParams,
} from './types.js';

// =============================================================================
// Enqueue — cria os placeholders + o job (transação) e devolve { jobId, targetId }.
// Em retry (`targets`), reutiliza os mesmos objetos (nova tentativa no lugar).
// =============================================================================

export class EnqueueError extends Error {
    code: string;

    constructor(
        message: string,
        code: string
    ) {
        super(message);
        this.code = code;
    }
}

/**
 * `TargetMode` (FILL/NEW_VERSION) é partilhado com o browser: vive em
 * `src/lib/ai/generation-job-types.ts` e chega cá via `./types`.
 */

export interface EnqueueTargetRequest {
    format: string;
    targetId: string;
    /**
     * FILL (default) regenera por cima do target. NEW_VERSION clona a peça
     * (nova versão) e deixa a original intacta — para "Gerar peça com o prompt"
     * quando a peça já tem conteúdo.
     */
    mode?: TargetMode;
}

export interface EnqueueInput {
    jobType: GenerationJobTypeValue;
    workspaceId: string;
    userId?: string | null;
    params: GenerationJobParams;
    /** Retry: reutilizar estes targets em vez de criar placeholders. */
    targets?: EnqueueTargetRequest[];
}

export interface EnqueueResult {
    jobId: string;
    targetId: string;
}

const CONTENT_FORMATS = new Set([
    'CAROUSEL',
    'SHORT_VIDEO',
    'LINKEDIN_POST',
    'IMAGE',
    'THREAD',
    'CTA_POST',
    'VIDEO_SCRIPT',
]);

const SOCIAL_CHANNELS = new Set([
    'LINKEDIN',
    'INSTAGRAM',
    'TIKTOK',
    'YOUTUBE',
    'TWITTER',
    'FACEBOOK',
    'THREADS',
    'PINTEREST',
    'TELEGRAM',
    'WHATSAPP',
]);

function assertFormat(value: string): asserts value is ContentFormat {
    if (!CONTENT_FORMATS.has(value)) {
        throw new EnqueueError(`Formato de conteúdo inválido: ${value}`, 'INVALID_FORMAT');
    }
}

function assertChannel(value: string): asserts value is SocialChannel {
    if (!SOCIAL_CHANNELS.has(value)) {
        throw new EnqueueError(`Canal de publicação inválido: ${value}`, 'INVALID_CHANNEL');
    }
}

// -----------------------------------------------------------------------------
// Transacção com prazo + retry
// -----------------------------------------------------------------------------

/**
 * O default do Prisma para `maxWait` são 2000 ms. O `pg.Pool` entrega ligações
 * imediatamente quando tem uma livre, mas reabrir sessão no Supavisor (modo
 * sessão) depois de o pool ficar ocioso passa de 2 s com regularidade — e aí
 * morria com "Unable to start a transaction in the given time". 15 s dá margem
 * para esse cold start; `timeout` é o limite de execução do callback.
 */
const TX_MAX_WAIT_MS = 15_000;
const TX_TIMEOUT_MS = 20_000;

/** Erros de saturação/conexão — valem um retry; erros de domínio, não. */
function isRetryableDbError(err: unknown): boolean {
    if (err instanceof EnqueueError) return false;

    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: unknown } | null)?.code;

    return (
        code === 'P1008' || // can't reach database server
        code === 'P2024' || // timed out fetching a new connection from the pool
        code === 'P2028' || // Unable to start a transaction in the given time
        code === 'P2034' || // write conflict / deadlock
        // Supavisor a recusar/resetar ligações (limite pool_size do modo sessão)
        /EMAXCONNSESSION/i.test(message) ||
        /ConnectionClosed|Server has closed the connection/i.test(message) ||
        /connection.*(terminated|timeout|refused|reset)/i.test(message) ||
        /too many clients|timeout expired/i.test(message)
    );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Corre a transacção com retry em erros de infra. `EnqueueError` (workspace sem
 * provider, formato inválido…) propaga à primeira: repetir não ia mudar nada.
 */
async function withTransactionRetry<T>(
    run: (tx: Tx) => Promise<T>,
    maxAttempts = 3
): Promise<T> {
    const delays = [200, 600, 1400];

    for (let attempt = 1; ; attempt++) {
        try {
            return await prisma.$transaction(run, {
                maxWait: TX_MAX_WAIT_MS,
                timeout: TX_TIMEOUT_MS,
            });
        } catch (err) {
            if (attempt >= maxAttempts || !isRetryableDbError(err)) throw err;

            // Backoff exponencial + jitter (±40%) para não sincronizar retries.
            const base = delays[attempt - 1] ?? delays[delays.length - 1]!;
            const jitter = base * 0.4 * (Math.random() * 2 - 1);
            console.warn(
                `[enqueue] transacção falhou (tentativa ${attempt}/${maxAttempts}), a repetir:`,
                err instanceof Error ? err.message : err
            );
            await sleep(base + jitter);
        }
    }
}

/**
 * Cria o job + placeholders. Não envia o evento Inngest (quem chama envia).
 * Correr dentro de uma transação: se a criação falhar, nada fica a meio.
 */
export async function enqueueGeneration(input: EnqueueInput): Promise<EnqueueResult> {
    const { jobType, workspaceId, userId, params, targets } = input;
    const now = new Date();

    // 0. Workspace existe.
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
    });
    if (!workspace) {
        throw new EnqueueError('Workspace não encontrado.', 'WORKSPACE_NOT_FOUND');
    }

    // 1. Providers disponíveis (activos + chave) — sem isto não há geração.
    const providerCount = await prisma.aIProvider.count({
        where: {
            isActive: true,
            apiKeyEncrypted: { not: null },
            OR: userId ? [{ userId }, { workspaceId }] : [{ workspaceId }],
        },
    });
    if (providerCount === 0) {
        throw new EnqueueError(
            'Nenhum provider de IA configurado com chave. Adiciona um provider nas Definições de IA.',
            'NO_PROVIDER'
        );
    }

    const jobId = randomUUID();
    let targetId = '';
    let items: GenerationJobItem[] = [];

    // `withTransactionRetry` é que abre a transacção; o callback corre já dentro
    // dela. `targetId`/`items` são reatribuídos a cada tentativa (o rollback
    // descarta o placeholder da tentativa anterior).
    await withTransactionRetry(async (tx) => {
        switch (jobType) {
            case 'NEW_ARTICLE':
                ({ targetId, items } = await enqueueNewArticle(tx, {
                    workspaceId,
                    userId,
                    params: params as NewArticleJobParams,
                    targets,
                    now,
                }));
                break;

            case 'CONTENT_PIECES':
                ({ targetId, items } = await enqueueContentPieces(tx, {
                    workspaceId,
                    params: params as ContentPiecesJobParams,
                    targets,
                    now,
                }));
                break;

            case 'VIDEO_SCRIPT':
                ({ targetId, items } = await enqueueVideoScript(tx, {
                    workspaceId,
                    params: params as VideoScriptJobParams,
                    targets,
                    now,
                }));
                break;

            case 'CONTENT_PROMPT':
                ({ targetId, items } = await enqueueContentPrompts(tx, {
                    workspaceId,
                    params: params as ContentPiecesJobParams,
                    targets,
                    now,
                }));
                break;

            case 'CONTENT_ITEM':
                ({ targetId, items } = await enqueueContentItem(tx, {
                    workspaceId,
                    params: params as ContentItemJobParams,
                    now,
                }));
                break;

            default:
                throw new EnqueueError(
                    `Tipo de job inválido: ${String(jobType)}`,
                    'INVALID_JOB_TYPE'
                );
        }

        await tx.generationJob.create({
            data: {
                id: jobId,
                jobType,
                workspaceId,
                userId: userId ?? null,
                status: 'QUEUED',
                items: items as unknown as object,
                params: params as unknown as object,
                targetId: targetId || null,
                createdAt: now,
                updatedAt: now,
            },
        });
    });

    return { jobId, targetId };
}

// -----------------------------------------------------------------------------
// Por tipo — placeholders (fresh) ou reutilização (retry)
// -----------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function enqueueNewArticle(
    tx: Tx,
    args: {
        workspaceId: string;
        userId?: string | null;
        params: NewArticleJobParams;
        targets?: EnqueueTargetRequest[];
        now: Date;
    }
): Promise<{ targetId: string; items: GenerationJobItem[] }> {
    const { workspaceId, userId, params, targets, now } = args;

    if (params.pillarId) {
        const pillar = await tx.pillarConfig.findFirst({
            where: { id: params.pillarId, workspaceId },
        });
        if (!pillar) {
            throw new EnqueueError('Pilar de conteúdo não encontrado.', 'PILLAR_NOT_FOUND');
        }
    }

    let articleId = targets?.[0]?.targetId;

    if (articleId) {
        const article = await tx.article.findFirst({
            where: { id: articleId, workspaceId },
        });
        if (!article) {
            throw new EnqueueError('Artigo de destino não encontrado.', 'TARGET_NOT_FOUND');
        }
    } else {
        articleId = randomUUID();
        await tx.article.create({
            data: {
                id: articleId,
                workspaceId,
                productId: params.productId ?? null,
                pillarId: params.pillarId ?? null,
                title: 'A gerar artigo…',
                slug: `a-gerar-${now.getTime().toString(36)}-${randomUUID().slice(0, 4)}`,
                summary: null,
                body: '',
                seoTitle: null,
                seoDescription: null,
                keywords: [],
                status: 'DRAFT',
                aiGenerated: true,
                aiPromptUsed: null,
                readingTimeMin: null,
                createdBy: userId ?? null,
                createdAt: now,
                updatedAt: now,
            },
        });
    }

    return {
        targetId: articleId,
        items: [
            {
                format: 'NEW_ARTICLE',
                targetId: articleId,
                status: 'QUEUED',
                error: null,
            },
        ],
    };
}

/**
 * Valida artigo + pilar herdado, partilhado por CONTENT_PIECES e
 * CONTENT_PROMPT (mesmos params, mesmo pedido). O pilar vem de
 * `params.pillarId` quando explícito, senão do pilar do artigo.
 */
async function resolveContentScope(
    tx: Tx,
    workspaceId: string,
    params: ContentPiecesJobParams
): Promise<{ pillar: ContentPillar | null }> {
    const article = await tx.article.findUnique({ where: { id: params.articleId } });
    if (!article || article.workspaceId !== workspaceId) {
        throw new EnqueueError('Artigo associado não encontrado.', 'ARTICLE_NOT_FOUND');
    }

    const pillarRow = params.pillarId
        ? await tx.pillarConfig.findFirst({
              where: { id: params.pillarId, workspaceId },
          })
        : article.pillarId
          ? await tx.pillarConfig.findFirst({
                where: { id: article.pillarId, workspaceId },
            })
          : null;
    if (params.pillarId && !pillarRow) {
        throw new EnqueueError('Pilar de conteúdo não encontrado.', 'PILLAR_NOT_FOUND');
    }

    return { pillar: (pillarRow?.pillar ?? null) as ContentPillar | null };
}

/** Garante que a peça de destino existe e pertence ao artigo/workspace. */
async function assertTargetPiece(
    tx: Tx,
    workspaceId: string,
    articleId: string,
    target: EnqueueTargetRequest
): Promise<void> {
    assertFormat(target.format);
    const piece = await tx.contentPiece.findFirst({
        where: { id: target.targetId, workspaceId, articleId },
    });
    if (!piece) {
        throw new EnqueueError(
            `Peça de destino não encontrada: ${target.format}`,
            'TARGET_NOT_FOUND'
        );
    }
}

/** Cria a peça-placeholder (sem conteúdo) e devolve o id. */
async function createPlaceholderPiece(
    tx: Tx,
    args: {
        workspaceId: string;
        articleId: string;
        productId?: string | null;
        channelId?: string | null;
        format: ContentFormat;
        pillar: ContentPillar | null;
        title: string;
        status: 'DRAFT' | 'PROMPT_READY';
        now: Date;
    }
): Promise<string> {
    const pieceId = randomUUID();
    await tx.contentPiece.create({
        data: {
            id: pieceId,
            articleId: args.articleId,
            workspaceId: args.workspaceId,
            productId: args.productId ?? null,
            channelId: args.channelId ?? null,
            format: args.format,
            pillar: args.pillar,
            title: args.title,
            body: '',
            hookText: null,
            ctaText: null,
            hashtags: [],
            slides: Prisma.DbNull,
            slideCount: null,
            status: args.status,
            aiGenerated: true,
            createdAt: args.now,
            updatedAt: args.now,
        },
    });
    return pieceId;
}

async function enqueueContentPieces(
    tx: Tx,
    args: {
        workspaceId: string;
        params: ContentPiecesJobParams;
        targets?: EnqueueTargetRequest[];
        now: Date;
    }
): Promise<{ targetId: string; items: GenerationJobItem[] }> {
    const { workspaceId, params, targets, now } = args;

    const { pillar } = await resolveContentScope(tx, workspaceId, params);

    if (targets?.length) {
        for (const t of targets) {
            await assertTargetPiece(tx, workspaceId, params.articleId, t);
        }
    } else {
        for (const format of params.formats) assertFormat(format);
    }

    const items: GenerationJobItem[] = [];

    if (targets?.length) {
        for (const t of targets) {
            const pieceId =
                t.mode === 'NEW_VERSION'
                    ? await clonePieceVersion(tx, t.targetId, now)
                    : t.targetId;
            items.push({
                format: t.format,
                targetId: pieceId,
                status: 'QUEUED',
                error: null,
            });
        }
    } else {
        for (const format of params.formats) {
            const pieceId = await createPlaceholderPiece(tx, {
                workspaceId,
                articleId: params.articleId,
                productId: params.productId,
                channelId: params.channelIds?.[format] ?? null,
                format: format as ContentFormat,
                pillar,
                title: 'A gerar peça…',
                status: 'DRAFT',
                now,
            });
            items.push({
                format: format as string,
                targetId: pieceId,
                status: 'QUEUED',
                error: null,
            });
        }
    }

    return { targetId: params.articleId, items };
}

/**
 * Clona uma peça (e os prompts dela) para uma nova peça em PROMPT_READY:
 * é a "nova versão" de "Gerar peça com este prompt" quando a peça já tem
 * conteúdo. A original fica intacta.
 */
async function clonePieceVersion(
    tx: Tx,
    sourceId: string,
    now: Date
): Promise<string> {
    const source = await tx.contentPiece.findUnique({ where: { id: sourceId } });
    if (!source) {
        throw new EnqueueError(
            'Peça de destino não encontrada.',
            'TARGET_NOT_FOUND'
        );
    }

    const newId = randomUUID();
    await tx.contentPiece.create({
        data: {
            id: newId,
            articleId: source.articleId,
            workspaceId: source.workspaceId,
            productId: source.productId,
            channelId: source.channelId,
            format: source.format,
            pillar: source.pillar,
            title: source.title ? `${source.title} (v2)` : 'Nova versão',
            body: '',
            hookText: null,
            ctaText: null,
            hashtags: [],
            slides: Prisma.DbNull,
            slideCount: null,
            // A nova peça nasce só com o prompt (copiado do original). Se a
            // geração falhar, fica em PROMPT_READY — escondida em /content e
            // fora das contagens — em vez de um DRAFT vazio aXiv.
            status: 'PROMPT_READY',
            aiGenerated: true,
            createdAt: now,
            updatedAt: now,
        },
    });

    // O prompt é o que vai gerar a nova versão: copiamos tal e qual.
    const prompts = await tx.contentGenerationPrompt.findMany({
        where: { targetType: 'PIECE', targetId: sourceId },
    });
    if (prompts.length > 0) {
        await tx.contentGenerationPrompt.createMany({
            data: prompts.map((p) => ({
                targetType: 'PIECE' as const,
                targetId: newId,
                itemKey: p.itemKey,
                prompt: p.prompt,
                providerId: p.providerId,
                modelCode: p.modelCode,
                // A marca de edição manual acompanha a cópia: o prompt da nova
                // versão é o mesmo que o utilizador escreveu.
                editedAt: p.editedAt,
                createdAt: now,
            })),
        });
    }

    return newId;
}

// -----------------------------------------------------------------------------
// CONTENT_PROMPT — cria as peças em PROMPT_READY (só o prompt, sem conteúdo)
// -----------------------------------------------------------------------------

async function enqueueContentPrompts(
    tx: Tx,
    args: {
        workspaceId: string;
        params: ContentPiecesJobParams;
        targets?: EnqueueTargetRequest[];
        now: Date;
    }
): Promise<{ targetId: string; items: GenerationJobItem[] }> {
    const { workspaceId, params, targets, now } = args;

    // Mesma validação de artigo/pilar/formato que o CONTENT_PIECES — só muda
    // o que é criado: uma peça em PROMPT_READY em vez de um DRAFT.
    const { pillar } = await resolveContentScope(tx, workspaceId, params);

    const items: GenerationJobItem[] = [];

    if (targets?.length) {
        // Reescrever o prompt de peças existentes (não clona: a peça mantém-se).
        for (const t of targets) {
            await assertTargetPiece(tx, workspaceId, params.articleId, t);
            items.push({ format: t.format, targetId: t.targetId, status: 'QUEUED', error: null });
        }
    } else {
        for (const format of params.formats) {
            assertFormat(format);
            const pieceId = await createPlaceholderPiece(tx, {
                workspaceId,
                articleId: params.articleId,
                productId: params.productId,
                channelId: params.channelIds?.[format] ?? null,
                format: format as ContentFormat,
                pillar,
                title: 'A escrever prompt…',
                status: 'PROMPT_READY',
                now,
            });
            items.push({ format, targetId: pieceId, status: 'QUEUED', error: null });
        }
    }

    return { targetId: params.articleId, items };
}

// -----------------------------------------------------------------------------
// CONTENT_ITEM — regenera UM item (slide-N / tweet-N) da peça
// -----------------------------------------------------------------------------

async function enqueueContentItem(
    tx: Tx,
    args: {
        workspaceId: string;
        params: ContentItemJobParams;
        now: Date;
    }
): Promise<{ targetId: string; items: GenerationJobItem[] }> {
    const { workspaceId, params } = args;

    const piece = await tx.contentPiece.findFirst({
        where: { id: params.pieceId, workspaceId },
    });
    if (!piece) {
        throw new EnqueueError('Peça não encontrada.', 'TARGET_NOT_FOUND');
    }

    const prompt = await tx.contentGenerationPrompt.findFirst({
        where: { targetType: 'PIECE', targetId: piece.id, itemKey: params.itemKey },
    });
    if (!prompt) {
        throw new EnqueueError(
            `Esta peça não tem prompt para "${params.itemKey}".`,
            'PROMPT_NOT_FOUND'
        );
    }

    return {
        targetId: piece.id,
        items: [
            {
                format: piece.format,
                targetId: piece.id,
                status: 'QUEUED',
                error: null,
            },
        ],
    };
}

async function enqueueVideoScript(
    tx: Tx,
    args: {
        workspaceId: string;
        params: VideoScriptJobParams;
        targets?: EnqueueTargetRequest[];
        now: Date;
    }
): Promise<{ targetId: string; items: GenerationJobItem[] }> {
    const { workspaceId, params, targets, now } = args;

    assertChannel(params.targetChannel);
    if (!Number.isInteger(params.durationSec) || params.durationSec < 15 || params.durationSec > 600) {
        throw new EnqueueError(
            'Duração do roteiro inválida (15–600 segundos).',
            'INVALID_DURATION'
        );
    }

    const article = await tx.article.findUnique({ where: { id: params.articleId } });
    if (!article || article.workspaceId !== workspaceId) {
        throw new EnqueueError('Artigo associado não encontrado.', 'ARTICLE_NOT_FOUND');
    }

    let scriptId = targets?.[0]?.targetId;

    if (scriptId) {
        const script = await tx.videoScript.findFirst({
            where: { id: scriptId, workspaceId, articleId: params.articleId },
        });
        if (!script) {
            throw new EnqueueError('Roteiro de destino não encontrado.', 'TARGET_NOT_FOUND');
        }
    } else {
        scriptId = randomUUID();
        await tx.videoScript.create({
            data: {
                id: scriptId,
                articleId: params.articleId,
                workspaceId,
                title: 'A gerar roteiro…',
                hook: '',
                problem: null,
                solution: null,
                cta: '',
                fullScript: '',
                durationSec: params.durationSec,
                targetChannel: params.targetChannel as SocialChannel,
                onScreenText: null,
                bRoll: null,
                status: 'DRAFT',
                aiGenerated: true,
                createdAt: now,
                updatedAt: now,
            },
        });
    }

    return {
        targetId: scriptId,
        items: [
            {
                format: 'VIDEO_SCRIPT',
                targetId: scriptId,
                status: 'QUEUED',
                error: null,
            },
        ],
    };
}