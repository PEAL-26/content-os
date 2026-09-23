import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/lib/prisma';
import { Prisma } from '../../src/generated/prisma/client';
import type {
    ContentFormat,
    ContentPillar,
    SocialChannel,
} from '../../src/types/database';
import type {
    ContentPiecesJobParams,
    GenerationJobItem,
    GenerationJobParams,
    GenerationJobTypeValue,
    NewArticleJobParams,
    VideoScriptJobParams,
} from './types';

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

export interface EnqueueTargetRequest {
    format: string;
    targetId: string;
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

    await prisma.$transaction(async (tx) => {
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

    const article = await tx.article.findUnique({ where: { id: params.articleId } });
    if (!article || article.workspaceId !== workspaceId) {
        throw new EnqueueError('Artigo associado não encontrado.', 'ARTICLE_NOT_FOUND');
    }

    // Pilar herdado: params.pillarId > pilar do artigo.
    let pillarEnum: ContentPillar | null = null;
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
    pillarEnum = (pillarRow?.pillar ?? null) as ContentPillar | null;

    const formats = targets?.length
        ? targets.map((t) => t.format)
        : params.formats;
    if (targets?.length) {
        for (const t of targets) {
            assertFormat(t.format);
            const piece = await tx.contentPiece.findFirst({
                where: { id: t.targetId, workspaceId, articleId: params.articleId },
            });
            if (!piece) {
                throw new EnqueueError(
                    `Peça de destino não encontrada: ${t.format}`,
                    'TARGET_NOT_FOUND'
                );
            }
        }
    } else {
        for (const format of params.formats) assertFormat(format);
    }

    const items: GenerationJobItem[] = [];

    if (targets?.length) {
        for (const t of targets) {
            items.push({
                format: t.format,
                targetId: t.targetId,
                status: 'QUEUED',
                error: null,
            });
        }
    } else {
        for (const format of formats) {
            const pieceId = randomUUID();
            await tx.contentPiece.create({
                data: {
                    id: pieceId,
                    articleId: params.articleId,
                    workspaceId,
                    productId: params.productId ?? null,
                    channelId: params.channelIds?.[format] ?? null,
                    format: format as ContentFormat,
                    pillar: pillarEnum ?? null,
                    title: 'A gerar peça…',
                    body: '',
                    hookText: null,
                    ctaText: null,
                    hashtags: [],
                    slides: Prisma.DbNull,
                    slideCount: null,
                    status: 'DRAFT',
                    aiGenerated: true,
                    createdAt: now,
                    updatedAt: now,
                },
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