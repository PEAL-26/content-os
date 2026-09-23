import pLimit from 'p-limit';
import { prisma } from '../../src/lib/prisma';
import { Prisma } from '../../src/generated/prisma/client';
import { generateSlug } from '../../src/helpers/slug';
import {
    buildArticleSystemPrompt,
    buildArticleUserPrompt,
    parseArticleResponse,
} from '../../src/lib/ai/prompts';
import {
    buildContext,
    buildPortablePromptsForPiece,
    buildSingleItemPortablePrompt,
    buildSystemPromptForFormat,
    buildVideoScriptSystemPrompt,
    convertParsedToScript,
    parseGeneratedContent,
    parseVideoScriptResponse,
    type ParsedGeneratedPiece,
} from '../../src/lib/ai/content-prompts';
import {
    generateWithFallback,
    getAvailableProvidersFromStore,
} from '../../src/lib/ai/provider';
import type { GeneratedVideoScript } from '../../src/lib/ai/types';
import type { ContentFormat } from '../../src/types/database';
import type { PillarConfig } from '../../src/types/pillar';
import {
    loadGenerationContext,
    resolveSystemPrompt,
    toArticleClient,
    toPillarClient,
    toProductClient,
    withAdditionalInstructions,
} from './context';
import {
    getJob,
    markJobCompleted,
    markJobFailed,
    markJobRunning,
    saveGenerationPrompts,
    updateJobItems,
} from './job-store';
import { createServerTransport } from './transport';
import type {
    ContentPiecesJobParams,
    GenerationJobItem,
    GenerationJobParams,
    NewArticleJobParams,
    VideoScriptJobParams,
} from './types';

// =============================================================================
// Orquestração dos jobs — executa a geração reutilizando o núcleo puro do
// client (prompts/parsers/fallback). Falhas esperadas: items→FAILED (sem
// rethrow); erros inesperados: job→FAILED + rethrow (para o retry do Inngest).
// =============================================================================

const ARTICLE_TIMEOUT_MS = 300_000; // 5 min — artigos longos
const PIECE_TIMEOUT_MS = 180_000; // 3 min por peça/roteiro
const CONCURRENCY_LIMIT = 3; // peças em paralelo

type JobRow = NonNullable<Awaited<ReturnType<typeof getJob>>>;

/**
 * Ponto de entrada do job (chamado pelo handler Inngest). Guarda idempotente:
 * um job já COMPLETED não volta a correr.
 */
export async function runGenerationJob(
    jobId: string,
    runId: string
): Promise<void> {
    const job = await getJob(jobId);
    if (!job) return;
    if (job.status === 'COMPLETED') return;

    await markJobRunning(jobId, runId);

    const params = (job.params ?? {}) as unknown as GenerationJobParams;
    const items = ((job.items ?? []) as unknown as GenerationJobItem[]) ?? [];

    try {
        switch (job.jobType) {
            case 'NEW_ARTICLE':
                await runNewArticle(job, params as NewArticleJobParams, items);
                break;
            case 'CONTENT_PIECES':
                await runContentPieces(
                    job,
                    params as ContentPiecesJobParams,
                    items
                );
                break;
            case 'VIDEO_SCRIPT':
                await runVideoScript(
                    job,
                    params as VideoScriptJobParams,
                    items
                );
                break;
            default:
                throw new Error(`Tipo de job desconhecido: ${String(job.jobType)}`);
        }
    } catch (err) {
        const message =
            err instanceof Error ? err.message : 'Erro desconhecido';
        await markJobFailed(job.id, message, items);
        throw err; // deixa o retry do Inngest atuar
    }
}

// -----------------------------------------------------------------------------
// NEW_ARTICLE
// -----------------------------------------------------------------------------

async function runNewArticle(
    job: JobRow,
    params: NewArticleJobParams,
    items: GenerationJobItem[]
): Promise<void> {
    const ctx = await loadGenerationContext(job.workspaceId, job.userId);
    const preferred = params.preferred ?? ctx.defaultPreferred;

    const workspace = ctx.workspace;
    const pillar = await loadPillar(job.workspaceId, params.pillarId);
    const product = params.productId
        ? await prisma.product.findUnique({ where: { id: params.productId } })
        : null;

    const articleParams = {
        topic: params.topic,
        workspace,
        pillar,
        product: product ? toProductClient(product) : undefined,
    };

    const systemPrompt = await resolveSystemPrompt(
        job.workspaceId,
        job.userId,
        'article',
        () => buildArticleSystemPrompt(articleParams)
    );
    const fullSystem = withAdditionalInstructions(
        systemPrompt,
        params.additionalInstructions
    );

    const result = await generateWithFallback<
        NonNullable<ReturnType<typeof parseArticleResponse>['article']>
    >({
        providers: getAvailableProvidersFromStore(ctx.providers, ctx.apiKeys),
        apiKeys: ctx.apiKeys,
        preferred,
        buildSystem: () => fullSystem,
        buildPrompt: () => buildArticleUserPrompt(articleParams),
        parse: (text) => parseArticleResponse(text).article,
        defaultMaxTokens: 8000,
        transport: createServerTransport(ARTICLE_TIMEOUT_MS),
    });

    if (!result.ok || !result.data) {
        const error =
            result.error ?? 'Não foi possível gerar o artigo. Tenta novamente.';
        await markJobFailed(
            job.id,
            error,
            updateItemsForTarget(items, 'NEW_ARTICLE', {
                status: 'FAILED',
                error,
            })
        );
        return;
    }

    const article = result.data;
    const articleId = job.targetId ?? items[0]?.targetId;
    if (!articleId) {
        throw new Error('Job de artigo sem targetId.');
    }

    const slug = await ensureUniqueSlug(
        job.workspaceId,
        article.slug || generateSlug(article.title)
    );

    await prisma.article.update({
        where: { id: articleId },
        data: {
            title: article.title,
            slug,
            summary: article.summary,
            body: article.body,
            seoTitle: article.seoTitle,
            seoDescription: article.seoDescription,
            keywords: article.keywords,
            readingTimeMin: article.readingTimeMin,
            aiGenerated: true,
            aiPromptUsed: [result.system, result.prompt].filter(Boolean).join('\n\n'),
            updatedAt: new Date(),
        },
    });

    await markJobCompleted(
        job.id,
        updateItemsForTarget(items, 'NEW_ARTICLE', {
            status: 'COMPLETED',
            error: null,
        })
    );
}

// -----------------------------------------------------------------------------
// CONTENT_PIECES — paralelo com pLimit(3), escrita por item
// -----------------------------------------------------------------------------

async function runContentPieces(
    job: JobRow,
    params: ContentPiecesJobParams,
    items: GenerationJobItem[]
): Promise<void> {
    const ctx = await loadGenerationContext(job.workspaceId, job.userId);
    const preferred = params.preferred ?? ctx.defaultPreferred;

    const articleRow = await prisma.article.findUnique({
        where: { id: params.articleId },
    });
    if (!articleRow) {
        throw new Error('Artigo associado não encontrado.');
    }

    const workspace = ctx.workspace;
    const article = toArticleClient(articleRow);
    const pillar = await loadPillar(
        job.workspaceId,
        params.pillarId ?? articleRow.pillarId
    );
    const product = params.productId
        ? await prisma.product.findUnique({ where: { id: params.productId } })
        : null;

    const baseParams = {
        article,
        workspace,
        product: product ? toProductClient(product) : undefined,
        pillar,
    };

    // Estado mutável por item (progresso visível via realtime).
    const runningItems: GenerationJobItem[] = items.map((item) => ({
        ...item,
        status: 'RUNNING',
        error: null,
    }));

    const limit = pLimit(CONCURRENCY_LIMIT);
    await Promise.all(
        runningItems.map((item) =>
            limit(async () => {
                const format = item.format as ContentFormat;
                try {
                    await generatePieceInto(
                        job,
                        ctx,
                        {
                            ...baseParams,
                            workspace,
                        },
                        format,
                        item.targetId,
                        preferred,
                        params.additionalInstructions,
                        runningItems
                    );
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : 'Erro desconhecido';
                    setItemStatus(runningItems, item.targetId, {
                        status: 'FAILED',
                        error: message,
                    });
                    await updateJobItems(job.id, runningItems);
                }
            })
        )
    );

    const failedCount = runningItems.filter(
        (i) => i.status === 'FAILED'
    ).length;
    const completedCount = runningItems.filter(
        (i) => i.status === 'COMPLETED'
    ).length;

    if (failedCount === runningItems.length && completedCount === 0) {
        const error =
            runningItems[0]?.error ?? 'Todas as peças falharam a gerar.';
        await markJobFailed(job.id, error, runningItems);
    } else {
        await markJobCompleted(job.id, runningItems);
    }
}

async function generatePieceInto(
    job: JobRow,
    ctx: Awaited<ReturnType<typeof loadGenerationContext>>,
    params: {
        article: ReturnType<typeof toArticleClient>;
        workspace: typeof ctx.workspace;
        product?: ReturnType<typeof toProductClient>;
        pillar?: PillarConfig;
    },
    format: ContentFormat,
    pieceId: string,
    preferred: { providerId?: string | null; modelCode?: string | null },
    additionalInstructions: string | undefined,
    runningItems: GenerationJobItem[]
): Promise<void> {
    const systemPrompt = await resolveSystemPrompt(
        job.workspaceId,
        job.userId,
        format,
        () => buildSystemPromptForFormat(format, params)
    );
    const fullSystem = withAdditionalInstructions(
        systemPrompt,
        additionalInstructions
    );

    const result = await generateWithFallback<ParsedGeneratedPiece>({
        providers: getAvailableProvidersFromStore(ctx.providers, ctx.apiKeys),
        apiKeys: ctx.apiKeys,
        preferred,
        buildSystem: () => fullSystem,
        buildPrompt: () => buildContext(params),
        parse: (text) => parseGeneratedContent(format, text),
        maxAttempts: 2,
        defaultMaxTokens: 4000,
        transport: createServerTransport(PIECE_TIMEOUT_MS),
    });

    if (!result.ok || !result.data) {
        const error =
            result.error ??
            `Falha ao gerar a peça ${format}. Tenta novamente.`;
        setItemStatus(runningItems, pieceId, {
            status: 'FAILED',
            error,
        });
        await updateJobItems(job.id, runningItems);
        return;
    }

    const piece = result.data;

    await prisma.contentPiece.update({
        where: { id: pieceId },
        data: {
            title: piece.title,
            body: piece.body,
            hookText: piece.hookText,
            ctaText: piece.ctaText,
            hashtags: piece.hashtags,
            slides:
                piece.slides && piece.slides.length > 0
                    ? (piece.slides as unknown as Prisma.InputJsonArray)
                    : Prisma.DbNull,
            slideCount: piece.slideCount,
            aiGenerated: true,
            updatedAt: new Date(),
        },
    });

    const portablePrompts = buildPortablePromptsForPiece(
        format,
        params,
        piece,
        fullSystem
    );
    await saveGenerationPrompts('PIECE', pieceId, portablePrompts);

    setItemStatus(runningItems, pieceId, {
        status: 'COMPLETED',
        error: null,
    });
    await updateJobItems(job.id, runningItems);
}

// -----------------------------------------------------------------------------
// VIDEO_SCRIPT
// -----------------------------------------------------------------------------

async function runVideoScript(
    job: JobRow,
    params: VideoScriptJobParams,
    items: GenerationJobItem[]
): Promise<void> {
    const ctx = await loadGenerationContext(job.workspaceId, job.userId);
    const preferred = params.preferred ?? ctx.defaultPreferred;

    const articleRow = await prisma.article.findUnique({
        where: { id: params.articleId },
    });
    if (!articleRow) {
        throw new Error('Artigo associado não encontrado.');
    }

    const workspace = ctx.workspace;
    const article = toArticleClient(articleRow);
    const pillar = await loadPillar(job.workspaceId, articleRow.pillarId);
    const durationSec = params.durationSec;

    const systemPrompt = await resolveSystemPrompt(
        job.workspaceId,
        job.userId,
        'VIDEO_SCRIPT',
        () =>
            buildVideoScriptSystemPrompt({
                workspace,
                durationSec,
            })
    );
    const fullSystem = withAdditionalInstructions(
        systemPrompt,
        params.additionalInstructions
    );

    const result = await generateWithFallback<GeneratedVideoScript>({
        providers: getAvailableProvidersFromStore(ctx.providers, ctx.apiKeys),
        apiKeys: ctx.apiKeys,
        preferred,
        buildSystem: () => fullSystem,
        buildPrompt: () =>
            buildContext({
                article,
                workspace,
                pillar,
            }),
        parse: (text) => {
            const parsed = parseVideoScriptResponse(text);
            if (!parsed) return null;
            const script = convertParsedToScript(parsed, durationSec);
            if (script.title && script.hook && script.cta) return script;
            return null;
        },
        defaultMaxTokens: 4000,
        transport: createServerTransport(PIECE_TIMEOUT_MS),
    });

    if (!result.ok || !result.data) {
        const error =
            result.error ??
            'Não foi possível gerar o roteiro. Tenta novamente.';
        await markJobFailed(
            job.id,
            error,
            updateItemsForTarget(items, 'VIDEO_SCRIPT', {
                status: 'FAILED',
                error,
            })
        );
        return;
    }

    const script = result.data;
    const scriptId = job.targetId ?? items[0]?.targetId;
    if (!scriptId) {
        throw new Error('Job de roteiro sem targetId.');
    }

    await prisma.videoScript.update({
        where: { id: scriptId },
        data: {
            title: script.title,
            hook: script.hook,
            problem: script.problem,
            solution: script.solution,
            cta: script.cta,
            fullScript: script.fullScript ?? '',
            durationSec: script.durationSec,
            onScreenText: JSON.stringify(script.onScreenText),
            bRoll: JSON.stringify(script.bRoll),
            aiGenerated: true,
            updatedAt: new Date(),
        },
    });

    const portablePrompt = buildSingleItemPortablePrompt(
        'VIDEO_SCRIPT',
        { article, workspace },
        script.title,
        script.fullScript || script.solution || '',
        fullSystem
    );
    await saveGenerationPrompts('VIDEO_SCRIPT', scriptId, [
        { itemKey: 'main', prompt: portablePrompt },
    ]);

    await markJobCompleted(
        job.id,
        updateItemsForTarget(items, 'VIDEO_SCRIPT', {
            status: 'COMPLETED',
            error: null,
        })
    );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function loadPillar(
    workspaceId: string,
    pillarId?: string | null
): Promise<PillarConfig | undefined> {
    if (!pillarId) return undefined;
    const row = await prisma.pillarConfig.findFirst({
        where: { id: pillarId, workspaceId },
    });
    return row ? toPillarClient(row) : undefined;
}

function updateItemsForTarget(
    items: GenerationJobItem[],
    format: string,
    patch: { status: GenerationJobItem['status']; error: string | null }
): GenerationJobItem[] {
    return items.map((item) =>
        item.format === format ? { ...item, ...patch } : item
    );
}

function setItemStatus(
    items: GenerationJobItem[],
    targetId: string,
    patch: { status: GenerationJobItem['status']; error: string | null }
): void {
    const item = items.find((i) => i.targetId === targetId);
    if (item) {
        item.status = patch.status;
        item.error = patch.error ?? null;
    }
}

async function ensureUniqueSlug(
    workspaceId: string,
    baseSlug: string
): Promise<string> {
    const slug = baseSlug || `artigo-${Date.now().toString(36)}`;
    const existing = await prisma.article.findFirst({
        where: { workspaceId, slug },
        select: { id: true },
    });
    if (!existing) return slug;

    let counter = 2;
    while (
        await prisma.article.findFirst({
            where: { workspaceId, slug: `${slug}-${counter}` },
            select: { id: true },
        })
    ) {
        counter++;
    }
    return `${slug}-${counter}`;
}