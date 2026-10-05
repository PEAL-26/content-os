import pLimit from 'p-limit';
import { prisma } from '../../src/lib/prisma.js';
import { Prisma } from '../../src/generated/prisma/client.js';
import { generateSlug } from '../../src/helpers/slug.js';
import {
    ARTICLE_METADATA_CONTENT_TYPE,
    articleMetadataUpdateData,
    buildArticleMetadataSystemPrompt,
    buildArticleMetadataUserPrompt,
    parseArticleMetadataResponse,
    type ParsedArticleMetadata,
} from '../../src/lib/ai/article-metadata.js';
import {
    buildArticleSystemPrompt,
    buildArticleUserPrompt,
    parseArticleResponse,
} from '../../src/lib/ai/prompts.js';
import {
    applySingleItemToPiece,
    buildContext,
    buildItemPortablePrompt,
    buildPortablePromptsForPiece,
    buildSingleItemPortablePrompt,
    buildSystemPromptForFormat,
    buildVideoScriptSystemPrompt,
    convertParsedToScript,
    parseGeneratedContent,
    parseSingleItemResponse,
    parseVideoScriptResponse,
    type ParsedGeneratedPiece,
} from '../../src/lib/ai/content-prompts.js';
import { METADATA_FIELDS } from '../../src/lib/ai/article-metadata.js';
import { MAIN_ITEM_KEY } from '../../src/lib/ai/generation-job-types.js';
import {
    buildPromptWriterSystemPrompt,
    buildPromptWriterUserPrompt,
    parseWrittenPrompt,
    promptWriterContentType,
    PROMPT_WRITER_FORMAT_LABELS,
} from '../../src/lib/ai/prompt-writer.js';
import {
    generateWithFallback,
    getAvailableProvidersFromStore,
} from '../../src/lib/ai/provider.js';
import type { GeneratedVideoScript } from '../../src/lib/ai/types.js';
import type { ContentFormat } from '../../src/types/database.js';
import type { PillarConfig } from '../../src/types/pillar.js';
import {
    loadGenerationContext,
    resolveSystemPrompt,
    slidesToClient,
    toArticleClient,
    toPillarClient,
    toProductClient,
    withAdditionalInstructions,
} from './context.js';
import {
    getGenerationPrompt,
    getJob,
    markJobCompleted,
    markJobFailed,
    markJobRunning,
    saveGenerationPrompts,
    updateJobItems,
} from './job-store.js';
import { createServerTransport } from './transport.js';
import type {
    ArticleMetadataJobParams,
    ContentItemJobParams,
    ContentPiecesJobParams,
    GenerationJobItem,
    GenerationJobParams,
    NewArticleJobParams,
    VideoScriptJobParams,
} from './types.js';

// =============================================================================
// Orquestração dos jobs — executa a geração reutilizando o núcleo puro do
// client (prompts/parsers/fallback). Falhas esperadas: items→FAILED (sem
// rethrow); erros inesperados: job→FAILED + rethrow (para o retry do Inngest).
// =============================================================================

const ARTICLE_TIMEOUT_MS = 300_000; // 5 min — artigos longos
const PIECE_TIMEOUT_MS = 180_000; // 3 min por peça/roteiro
const CONCURRENCY_LIMIT = 3; // peças em paralelo
/**
 * Metadados: uma chamada, output pequeno (um JSON). O input pesado é o body do
 * artigo, não a resposta — por isso o tecto do provider serve bem e o timeout
 * é só a rede de segurança.
 */
const METADATA_TIMEOUT_MS = 120_000;

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
            case 'CONTENT_PROMPT':
                await runContentPrompts(
                    job,
                    params as ContentPiecesJobParams,
                    items
                );
                break;
            case 'CONTENT_ITEM':
                await runContentItem(job, params as ContentItemJobParams);
                break;
            case 'ARTICLE_METADATA':
                await runArticleMetadata(
                    job,
                    params as ArticleMetadataJobParams,
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
                        runningItems,
                        // Só o botão "Gerar peça" (a partir do prompt guardado)
                        // pede explicitamente o prompt. Sem este sinal, a geração
                        // parte do contexto do artigo — é o que o "Repetir" faz.
                        Boolean(params.useStoredPrompt)
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
    runningItems: GenerationJobItem[],
    /** Usa o prompt gravado da peça em vez do contexto automático. */
    useStoredPrompt: boolean
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

    // O prompt da peça (itemKey 'main') é a mensagem de geração quando existe
    // e o pedido é explícito. Sem ele, cai no contexto automático.
    const storedPrompt = useStoredPrompt
        ? await getGenerationPrompt('PIECE', pieceId, MAIN_ITEM_KEY)
        : null;

    const result = await generateWithFallback<ParsedGeneratedPiece>({
        providers: getAvailableProvidersFromStore(ctx.providers, ctx.apiKeys),
        apiKeys: ctx.apiKeys,
        preferred,
        buildSystem: () => fullSystem,
        buildPrompt: () => storedPrompt ?? buildContext(params),
        parse: (text) => parseGeneratedContent(format, text),
        maxAttempts: 2,
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

    // Só o placeholder sai de PROMPT_READY: a peça passa a ter conteúdo. Os
    // restantes estados são preservados — o plano só previa esta transição, e
    // despromover para DRAFT uma peça já APPROVED/PUBLISHED que o utilizador
    // mandou regenerar ("Repetir") seria perder a aprovação sem ele ter pedido.
//
// Numa transacção, para não existir janela com `DRAFT` e `body: ''`: uma
// queda do processo entre as duas escritas deixaria um rascunho fantasma
// (visível em /content e fora das contagens) que não é peça "só com prompt"
// nem peça com conteúdo.
await prisma.$transaction([
        prisma.contentPiece.updateMany({
            where: { id: pieceId, status: 'PROMPT_READY' },
            data: { status: 'DRAFT' },
        }),
        prisma.contentPiece.update({
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
        }),
    ]);

    // A peça gerada passa a ter sempre um prompt 'main' editável: ou o prompt
    // do utilizador que a gerou (preservado abaixo), ou a mensagem automática
    // que foi de facto enviada (para haver sempre "Gerar peça com este prompt").
    //
    // O 'main' que a peça já traz é descartado antes de voltar a guardar: sem
    // isto os formatos de item único (LINKEDIN_POST, IMAGE, …) gravavam duas
    // linhas 'main' e `getGenerationPrompt` devolvia uma delas ao acaso.
    const portablePrompts = buildPortablePromptsForPiece(
        format,
        params,
        piece,
        fullSystem
    ).filter((p) => p.itemKey !== MAIN_ITEM_KEY);
    if (!storedPrompt) {
        portablePrompts.push({
            itemKey: MAIN_ITEM_KEY,
            prompt: buildSingleItemPortablePrompt(
                format,
                params,
                piece.title,
                piece.body,
                fullSystem
            ),
        });
    }
    // `storedPrompt` é o 'main' do utilizador — preserva-o no delete+insert.
    await saveGenerationPrompts(
        'PIECE',
        pieceId,
        portablePrompts,
        storedPrompt ? [MAIN_ITEM_KEY] : []
    );

    setItemStatus(runningItems, pieceId, {
        status: 'COMPLETED',
        error: null,
    });
    await updateJobItems(job.id, runningItems);
}

// -----------------------------------------------------------------------------
// CONTENT_PROMPT — escreve o prompt da peça (não gera o conteúdo)
// -----------------------------------------------------------------------------

async function runContentPrompts(
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
                    const written = await writePromptForPiece({
                        workspaceId: job.workspaceId,
                        userId: job.userId,
                        ctx,
                        article,
                        workspace,
                        product: product ? toProductClient(product) : undefined,
                        pillar,
                        format,
                        channelId: params.channelIds?.[format] ?? null,
                        additionalInstructions: params.additionalInstructions,
                        preferred,
                    });

                    if (!written) {
                        throw new Error(
                            'A IA não devolveu um prompt válido. Tenta novamente.'
                        );
                    }

                    // Só o prompt: a peça continua em PROMPT_READY, sem conteúdo.
                    // Os prompts por item (slide-N/tweet-N) continuam válidos —
                    // reescrever o 'main' não muda o conteúdo que descrevem —
                    // por isso são preservados (decisão 4 do plano). O que se
                    // substitui é só o 'main', daí preservar *todas as outras*
                    // chaves em vez de preservar o 'main'.
                    const keep = await preservedItemKeys(
                        'PIECE',
                        item.targetId,
                        MAIN_ITEM_KEY
                    );
                    await saveGenerationPrompts(
                        'PIECE',
                        item.targetId,
                        [{ itemKey: MAIN_ITEM_KEY, prompt: written.prompt }],
                        keep
                    );

                    await prisma.contentGenerationPrompt.updateMany({
                        where: {
                            targetType: 'PIECE',
                            targetId: item.targetId,
                            itemKey: MAIN_ITEM_KEY,
                        },
                        data: {
                            providerId: written.providerId,
                            modelCode: written.modelCode,
                        },
                    });

                    // O título "A escrever prompt…" já não é verdade: a peça
                    // continua sem conteúdo, mas o prompt está escrito.
                    await prisma.contentPiece.updateMany({
                        where: {
                            id: item.targetId,
                            // Só peças que ainda não têm conteúdo — numa
                            // reescrita o título do utilizador é sacred.
                            body: '',
                            status: 'PROMPT_READY',
                        },
                        data: {
                            title: `Prompt de ${PROMPT_WRITER_FORMAT_LABELS[format]}`,
                            updatedAt: new Date(),
                        },
                    });

                    setItemStatus(runningItems, item.targetId, {
                        status: 'COMPLETED',
                        error: null,
                    });
                } catch (error) {
                    const message =
                        error instanceof Error
                            ? error.message
                            : 'Erro desconhecido';
                    setItemStatus(runningItems, item.targetId, {
                        status: 'FAILED',
                        error: message,
                    });
                }
                await updateJobItems(job.id, runningItems);
            })
        )
    );

    const failed = runningItems.filter((i) => i.status === 'FAILED');
    if (failed.length === runningItems.length && runningItems.length > 0) {
        await markJobFailed(
            job.id,
            failed[0]?.error ?? 'Todos os prompts falharam.',
            runningItems
        );
    } else {
        await markJobCompleted(job.id, runningItems);
    }
}

async function writePromptForPiece(args: {
    workspaceId: string;
    userId?: string | null;
    ctx: Awaited<ReturnType<typeof loadGenerationContext>>;
    article: ReturnType<typeof toArticleClient>;
    workspace: Awaited<ReturnType<typeof loadGenerationContext>>['workspace'];
    product?: ReturnType<typeof toProductClient>;
    pillar?: PillarConfig;
    format: ContentFormat;
    channelId: string | null;
    additionalInstructions?: string;
    preferred: { providerId?: string | null; modelCode?: string | null };
}): Promise<{
    prompt: string;
    providerId: string | null;
    modelCode: string | null;
} | null> {
    const {
        workspaceId,
        userId,
        ctx,
        article,
        workspace,
        product,
        pillar,
        format,
        channelId,
        additionalInstructions,
        preferred,
    } = args;

    // Label do canal destino (o prompt deve dizer para onde é a peça).
    let channelLabel: string | null = null;
    if (channelId) {
        const channel = await prisma.channelConfig.findUnique({
            where: { id: channelId },
        });
        if (channel) channelLabel = channel.channel;
    }

    // System do escritor: override workspace > user > default em código.
    const systemPrompt = await resolveSystemPrompt(
        workspaceId,
        userId,
        promptWriterContentType(format),
        () => buildPromptWriterSystemPrompt(format, { workspace, product })
    );
    const fullSystem = withAdditionalInstructions(
        systemPrompt,
        additionalInstructions
    );

    const userPrompt = buildPromptWriterUserPrompt({
        article,
        workspace,
        format,
        product,
        pillar,
        channelLabel,
        additionalInstructions,
    });

    const result = await generateWithFallback<string>({
        providers: getAvailableProvidersFromStore(ctx.providers, ctx.apiKeys),
        apiKeys: ctx.apiKeys,
        preferred,
        buildSystem: () => fullSystem,
        buildPrompt: () => userPrompt,
        parse: (text) => parseWrittenPrompt(text),
        maxAttempts: 2,
        transport: createServerTransport(PIECE_TIMEOUT_MS),
    });

    if (!result.ok || !result.data) return null;

    return {
        prompt: result.data,
        // Auditoria: provider/modelo que escreveram o prompt (gravados pelo
        // caller, depois de a linha do prompt existir).
        providerId: result.providerId ?? null,
        modelCode: result.modelCode ?? null,
    };
}

// -----------------------------------------------------------------------------
// CONTENT_ITEM — regenera UM item (slide-N / tweet-N) a partir do seu prompt
// -----------------------------------------------------------------------------

async function runContentItem(
    job: JobRow,
    params: ContentItemJobParams
): Promise<void> {
    const ctx = await loadGenerationContext(job.workspaceId, job.userId);
    const preferred = params.preferred ?? ctx.defaultPreferred;

    const pieceRow = await prisma.contentPiece.findFirst({
        where: { id: params.pieceId, workspaceId: job.workspaceId },
    });
    if (!pieceRow) {
        throw new Error('Peça não encontrada.');
    }

    const format = pieceRow.format as ContentFormat;
    const workspace = ctx.workspace;

    const articleRow = await prisma.article.findUnique({
        where: { id: pieceRow.articleId },
    });
    if (!articleRow) {
        throw new Error('Artigo associado não encontrado.');
    }
    const article = toArticleClient(articleRow);
    const pillar = await loadPillar(job.workspaceId, articleRow.pillarId);
    const product = pieceRow.productId
        ? await prisma.product.findUnique({ where: { id: pieceRow.productId } })
        : null;

    const itemPrompt = await getGenerationPrompt(
        'PIECE',
        pieceRow.id,
        params.itemKey
    );
    if (!itemPrompt) {
        await markJobFailed(
            job.id,
            `Esta peça não tem prompt para "${params.itemKey}".`,
            updateItemsForTarget(job.items as unknown as GenerationJobItem[], format, {
                status: 'FAILED',
                error: `Sem prompt para "${params.itemKey}".`,
            })
        );
        return;
    }

    const params2 = {
        article,
        workspace,
        product: product ? toProductClient(product) : undefined,
        pillar,
    };

    const systemPrompt = await resolveSystemPrompt(
        job.workspaceId,
        job.userId,
        format,
        () => buildSystemPromptForFormat(format, params2)
    );

    const result = await generateWithFallback<{ title: string | null; body: string }>({
        providers: getAvailableProvidersFromStore(ctx.providers, ctx.apiKeys),
        apiKeys: ctx.apiKeys,
        preferred,
        buildSystem: () => systemPrompt,
        // O prompt do item é a mensagem — é o que o utilizador editou.
        buildPrompt: () => itemPrompt,
        parse: (text) => parseSingleItemResponse(text),
        maxAttempts: 2,
        transport: createServerTransport(PIECE_TIMEOUT_MS),
    });

    if (!result.ok || !result.data) {
        const error = result.error ?? 'Não foi possível gerar o item.';
        await markJobFailed(
            job.id,
            error,
            updateItemsForTarget(job.items as unknown as GenerationJobItem[], format, {
                status: 'FAILED',
                error,
            })
        );
        return;
    }

    const item = result.data;
    const slides = pieceRow.slides
        ? (slidesToClient(pieceRow.slides) ?? null)
        : null;

    const applied = applySingleItemToPiece(
        format,
        { body: pieceRow.body, slides },
        params.itemKey,
        item
    );

    // Guarda optimista sobre `updatedAt`: se o utilizador editou a peça no modal
    // enquanto este job corria, escrever `body`/`slides` por cima apagaria essa
    // edição em silêncio. O job falha com uma mensagem explícita em vez disso.
    const { count: updatedRows } = await prisma.contentPiece.updateMany({
        where: { id: pieceRow.id, updatedAt: pieceRow.updatedAt },
        data: {
            body: applied.body,
            slides:
                applied.slides && applied.slides.length > 0
                    ? (applied.slides as unknown as Prisma.InputJsonArray)
                    : Prisma.DbNull,
            slideCount: applied.slideCount,
            updatedAt: new Date(),
        },
    });

    if (updatedRows === 0) {
        const staleError =
            'A peça foi alterada enquanto este item gerava. Volta a abrir a peça e repete.';
        await markJobFailed(
            job.id,
            staleError,
            updateItemsForTarget(job.items as unknown as GenerationJobItem[], format, {
                status: 'FAILED',
                error: staleError,
            })
        );
        return;
    }

    // O prompt do item é reconstruído a partir do novo conteúdo (invariante:
    // o prompt guardado reproduz o conteúdo actual). Só este item é tocado.
    await saveGenerationPrompts(
        'PIECE',
        pieceRow.id,
        [
            {
                itemKey: params.itemKey,
                prompt: buildItemPortablePrompt(
                    format,
                    params2,
                    params.itemKey,
                    item.body,
                    systemPrompt
                ),
            },
        ],
        // Preserva o 'main' e os restantes itens da peça.
        await preservedItemKeys('PIECE', pieceRow.id, params.itemKey)
    );

    await markJobCompleted(
        job.id,
        updateItemsForTarget(job.items as unknown as GenerationJobItem[], format, {
            status: 'COMPLETED',
            error: null,
        })
    );
}

// -----------------------------------------------------------------------------
// ARTICLE_METADATA — preenche os metadados em falta de um artigo que já existe.
//
// UMA chamada ao modelo cobre os N campos pedidos (barato e coerente entre
// campos); o `items` do job fica com um item por campo, cada um com o seu estado.
// O parse só devolve os campos pedidos — um clique em "Gerar resumo" não escreve
// o `seoTitle` que o modelo devolvesse por Iniciativa própria.
// -----------------------------------------------------------------------------

/** O item cujo `format` é um dos 4 campos de metadados deste job. */
function isMetadataItem(item: GenerationJobItem): boolean {
    return (METADATA_FIELDS as string[]).includes(item.format);
}

async function runArticleMetadata(
    job: JobRow,
    params: ArticleMetadataJobParams,
    items: GenerationJobItem[]
): Promise<void> {
    const ctx = await loadGenerationContext(job.workspaceId, job.userId);
    const preferred = params.preferred ?? ctx.defaultPreferred;

    const articleRow = await prisma.article.findFirst({
        where: { id: params.articleId, workspaceId: job.workspaceId },
    });
    if (!articleRow) {
        throw new Error('Artigo não encontrado neste workspace.');
    }

    const article = toArticleClient(articleRow);
    const workspace = ctx.workspace;
    const pillar = await loadPillar(job.workspaceId, articleRow.pillarId);
    const product = articleRow.productId
        ? await prisma.product.findUnique({ where: { id: articleRow.productId } })
        : null;

    // Só os items cujo `format` é um campo pedido (um retry pode vir com um
    // subconjunto). `items` é a fonte de verdade do que esta execução escreve.
    const requestedFields = METADATA_FIELDS.filter((field) =>
        items.some((item) => item.format === field)
    );

    if (requestedFields.length === 0) {
        await markJobFailed(
            job.id,
            'O job não tem nenhum campo de metadados para gerar.',
            items
        );
        return;
    }

    const runningItems: GenerationJobItem[] = items.map((item) =>
        isMetadataItem(item)
            ? { ...item, status: 'RUNNING', error: null }
            : item
    );

    const systemPrompt = await resolveSystemPrompt(
        job.workspaceId,
        job.userId,
        ARTICLE_METADATA_CONTENT_TYPE,
        () => buildArticleMetadataSystemPrompt({ workspace })
    );
    const fullSystem = withAdditionalInstructions(
        systemPrompt,
        params.additionalInstructions
    );

    const result = await generateWithFallback<ParsedArticleMetadata>({
        providers: getAvailableProvidersFromStore(ctx.providers, ctx.apiKeys),
        apiKeys: ctx.apiKeys,
        preferred,
        buildSystem: () => fullSystem,
        buildPrompt: () =>
            buildArticleMetadataUserPrompt({
                article,
                workspace,
                pillar,
                product: product ? toProductClient(product) : undefined,
                fields: requestedFields,
            }),
        // Só os pedidos; um campo em falta simplesmente não vem no resultado e
        // fica FAILED abaixo (com a sua própria mensagem), sem pôr em risco os
        // outros campos do mesmo job.
        parse: (text) => parseArticleMetadataResponse(text, requestedFields),
        maxAttempts: 2,
        transport: createServerTransport(METADATA_TIMEOUT_MS),
    });

    if (!result.ok || !result.data) {
        const error =
            result.error ??
            'Não foi possível gerar os metadados. Tenta novamente.';
        await markJobFailed(
            job.id,
            error,
            runningItems.map((item) =>
                isMetadataItem(item)
                    ? { ...item, status: 'FAILED', error }
                    : item
            )
        );
        return;
    }

    const update = articleMetadataUpdateData(result.data);
    const succeeded = new Set(Object.keys(update));

    // Um `article.update` com os campos válidos de uma vez: ou entra tudo, ou
    // não entra nada. `updatedAt` é tocado para o editor reagir.
    if (Object.keys(update).length > 0) {
        await prisma.article.update({
            where: { id: articleRow.id },
            data: { ...update, updatedAt: new Date() },
        });
    }

    const finalItems: GenerationJobItem[] = runningItems.map((item) => {
        if (!isMetadataItem(item)) return item;
        if (succeeded.has(item.format)) {
            return { ...item, status: 'COMPLETED', error: null };
        }
        // O modelo não devolveu este campo (em falta, inválido ou placeholder).
        return {
            ...item,
            status: 'FAILED',
            error: `A IA não devolveu um valor válido para "${item.format}".`,
        };
    });

    const failed = finalItems.filter((i) => i.status === 'FAILED');
    const completed = finalItems.filter((i) => i.status === 'COMPLETED');

    // Só é job falhado quando NENHUM campo ficou bom — uma falha parcial é um
    // job concluído com items a falhar, para o painel mostrar "Repetir" só
    // nesses (mesmo critério do CONTENT_PIECES).
    if (failed.length === finalItems.length && completed.length === 0) {
        await markJobFailed(
            job.id,
            failed[0]?.error ?? 'Todos os metadados falharam a gerar.',
            finalItems
        );
        return;
    }

    await markJobCompleted(job.id, finalItems);
}

/** Todas as chaves de prompt do target excepto a que vai ser substituída. */
async function preservedItemKeys(
    targetType: 'PIECE' | 'VIDEO_SCRIPT',
    targetId: string,
    replaceItemKey: string
): Promise<string[]> {
    const rows = await prisma.contentGenerationPrompt.findMany({
        where: { targetType, targetId, itemKey: { not: replaceItemKey } },
        select: { itemKey: true },
    });
    return rows
        .map((r) => r.itemKey)
        .filter((k): k is string => !!k);
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