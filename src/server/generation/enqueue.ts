import { randomUUID } from 'node:crypto';
import { prisma } from '../../src/lib/prisma.js';
import { Prisma } from '../../src/generated/prisma/client.js';
import type {
    ContentFormat,
    ContentPillar,
    MediaModality,
} from '../../src/types/database.js';
import { CONTENT_FORMAT_SET } from '../../src/helpers/content-format.js';
import type {
    ArticleMetadataJobParams,
    ContentItemJobParams,
    ContentPiecesJobParams,
    GenerationJobItem,
    GenerationJobParams,
    GenerationJobTypeValue,
    MediaArtifactJobParams,
    MediaPromptJobParams,
    NewArticleJobParams,
    TargetMode,
} from './types.js';
import { METADATA_FIELDS } from '../../src/lib/ai/article-metadata.js';



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

/** Modalidades de media válidas (os prompts são gerados automaticamente). */
const MEDIA_MODALITIES = new Set(['image', 'audio', 'video']);

function assertFormat(value: string): asserts value is ContentFormat {
    if (!CONTENT_FORMAT_SET.has(value)) {
        throw new EnqueueError(`Formato de conteúdo inválido: ${value}`, 'INVALID_FORMAT');
    }
}

function assertModality(value: string): asserts value is MediaModality {
    if (!MEDIA_MODALITIES.has(value)) {
        throw new EnqueueError(`Modalidade inválida: ${value}`, 'INVALID_MODALITY');
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

// -----------------------------------------------------------------------------
// Diagnóstico do NO_PROVIDER
// -----------------------------------------------------------------------------

/** Scope de providers: os do utilizador (globais) + os do workspace. */
type ProviderScope = Prisma.AIProviderWhereInput['OR'];

/**
 * Explica *porque* não há provider utilizável, em vez de repetir "não tens
 * nenhum provider configurado".
 *
 * A mensagem genérica escondeu um bug real durante horas: havia um provider com
 * chave e modelos, mas com `workspaceId = ''` — logo não pertencia a nenhum
 * scope e o count dava 0. A BD já rejeita scope vazio
 * (`20261002101500_reject_empty_scope_on_ai_scoped_tables`), mas alguém pode
 * reintroduzi-lo por fora de uma migration, e o mesmo se passa com providers sem
 * chave, sem modelo activo ou inactivos. Quatro contagens no caminho de erro
 * (que só corre quando a geração já ia falhar) valem a resposta certa.
 */
async function explainNoProvider(scope: ProviderScope): Promise<string> {
    const [totalNoScope, semChave, semModelo, orfaos] = await Promise.all([
        prisma.aIProvider.count({ where: { OR: scope } }),
        prisma.aIProvider.count({
            where: { OR: scope, apiKeyEncrypted: null },
        }),
        prisma.aIProvider.count({
            where: {
                OR: scope,
                apiKeyEncrypted: { not: null },
                models: { none: { isActive: true } },
            },
        }),
        // Scope vazio: `''` não é NULL, por isso escapa a qualquer igualdade
        // com um id real — o provider existe mas é invisível para toda a gente.
        prisma.aIProvider.count({
            where: { OR: [{ userId: '' }, { workspaceId: '' }] },
        }),
    ]);

    const emDefinicoes = 'Definições de IA';

    if (totalNoScope === 0) {
        return orfaos > 0
            ? `Nenhum provider de IA visível para este utilizador ou workspace. Há ${orfaos} provider(s) guardados sem dono (utilizador e workspace vazios), que não são visíveis para nenhum workspace — atribui-lhes o scope em ${emDefinicoes}.`
            : `Nenhum provider de IA configurado para este utilizador ou workspace. Adiciona um provider em ${emDefinicoes}.`;
    }

    if (semChave > 0) {
        return `Nenhum provider de IA com chave neste utilizador ou workspace: ${semChave} de ${totalNoScope} provider(s) ainda não têm chave de API. Configura-a em ${emDefinicoes}.`;
    }

    if (semModelo > 0) {
        return `Nenhum provider de IA com modelo activo: ${semModelo} provider(s) com chave não têm nenhum modelo activo. Activa um modelo em ${emDefinicoes}.`;
    }

    return `Nenhum provider de IA activo neste utilizador ou workspace (${totalNoScope} configurado(s), todos inactivos). Activa um provider em ${emDefinicoes}.`;
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

    // 1. Providers disponíveis (activos + chave + pelo menos um modelo activo) —
    //    sem isto não há geração.
    //
    //    O scope tem de ser o MESMO do runtime (`loadAvailableProviders`): os
    //    providers do utilizador E os do workspace. Um provider sem modelo
    //    activo também conta como indisponível — passava este check e rebentava
    //    no `pickModel` já depois do placeholder criado.
    const scope = userId ? [{ userId }, { workspaceId }] : [{ workspaceId }];

    const providerCount = await prisma.aIProvider.count({
        where: {
            isActive: true,
            apiKeyEncrypted: { not: null },
            models: { some: { isActive: true } },
            OR: scope,
        },
    });
    if (providerCount === 0) {
        throw new EnqueueError(await explainNoProvider(scope), 'NO_PROVIDER');
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

            case 'ARTICLE_METADATA':
                ({ targetId, items } = await enqueueArticleMetadata(tx, {
                    workspaceId,
                    params: params as ArticleMetadataJobParams,
                    now,
                }));
                break;

            case 'MEDIA_PROMPT':
                ({ targetId, items } = await enqueueMediaPrompt(tx, {
                    workspaceId,
                    params: params as MediaPromptJobParams,
                    now,
                }));
                break;

            case 'MEDIA_ARTIFACT':
                ({ targetId, items } = await enqueueMediaArtifact(tx, {
                    workspaceId,
                    params: params as MediaArtifactJobParams,
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
            scenes: Prisma.DbNull,
            durationSec: null,
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

    // Canais: validados e filtrados por ACTIVO. Um canal inactivo não pode
    // receber peça nova (Decisão 15) — mas o conteúdo já gerado continua
    // legível, por isso isto só vale na criação.
    const channelIds = await resolveActiveChannelIds(tx, workspaceId, params);

    for (const modality of params.modalities ?? []) assertModality(modality);

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
        // PRODUTO CARTESIANO canais × tipos (Decisão 10). Antes era um canal por
        // tipo, o que impedia pedir POST para LinkedIn e POST para Instagram na
        // mesma corrida. Sem canais, cai no canal primário (ou no primeiro activo)
        // para não deixar o utilizador sem geração possível.
        const effectiveChannels = channelIds.length
            ? channelIds
            : await fallbackChannelIds(tx, workspaceId);

        if (effectiveChannels.length === 0) {
            throw new EnqueueError(
                'Não tens canais activos. Activa um canal em Definições → Canais para gerar peças.',
                'NO_ACTIVE_CHANNEL'
            );
        }

        for (const format of params.formats) {
            assertFormat(format);
            for (const channelId of effectiveChannels) {
                const pieceId = await createPlaceholderPiece(tx, {
                    workspaceId,
                    articleId: params.articleId,
                    productId: params.productId,
                    channelId,
                    format,
                    pillar,
                    title: 'A gerar peça…',
                    status: 'DRAFT',
                    now,
                });
                items.push({
                    // O par (tipo, canal) vive na chave do item, porque agora há
                    // várias peças do mesmo tipo no mesmo job.
                    format: itemKey(format as ContentFormat, channelId),
                    targetId: pieceId,
                    status: 'QUEUED',
                    error: null,
                });
            }
        }
    }

    return { targetId: params.articleId, items };
}

/**
 * Chave do item de um CONTENT_PIECES: `<TIPO>@<canalId>`.
 *
 * Antes o `format` do item era só o tipo, o que ainda funcionava porque havia
 * uma peça por tipo. Com o produto cartesiano, dois items podem ter o mesmo
 * tipo em canais diferentes — e `setItemStatus`/`updateItemsForTarget`
 * procuram por `targetId`, por isso a chave é informativa. Ainda assim fica
 * explícita: o painel mostra "POST → Instagram" sem ter de ir buscar a peça.
 */
export function itemKey(format: ContentFormat, channelId: string): string {
    return `${format}@${channelId}`;
}

/** Separa a chave do item em (tipo, canalId). */
export function parseItemKey(
    key: string
): { format: ContentFormat | null; channelId: string | null } {
    const at = key.lastIndexOf('@');
    if (at <= 0) {
        return {
            format: CONTENT_FORMAT_SET.has(key) ? (key as ContentFormat) : null,
            channelId: null,
        };
    }
    const format = key.slice(0, at);
    const channelId = key.slice(at + 1);
    return {
        format: CONTENT_FORMAT_SET.has(format) ? (format as ContentFormat) : null,
        channelId,
    };
}

/** Canais pedidos que existem no workspace e estão ACTIVOS. */
async function resolveActiveChannelIds(
    tx: Tx,
    workspaceId: string,
    params: ContentPiecesJobParams
): Promise<string[]> {
    const requested = params.channelIds ?? [];
    if (requested.length === 0) return [];

    const rows = await tx.channelConfig.findMany({
        where: { id: { in: requested }, workspaceId, isActive: true },
        select: { id: true },
    });
    return rows.map((r) => r.id);
}

/** Canal primário, ou o primeiro activo — para nunca ficar sem geração. */
async function fallbackChannelIds(tx: Tx, workspaceId: string): Promise<string[]> {
    const row = await tx.channelConfig.findFirst({
        where: { workspaceId, isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
    });
    return row ? [row.id] : [];
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
            scenes: Prisma.DbNull,
            durationSec: source.durationSec,
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

    const channelIds = await resolveActiveChannelIds(tx, workspaceId, params);

    const items: GenerationJobItem[] = [];

    if (targets?.length) {
        // Reescrever o prompt de peças existentes (não clona: a peça mantém-se).
        for (const t of targets) {
            await assertTargetPiece(tx, workspaceId, params.articleId, t);
            items.push({ format: t.format, targetId: t.targetId, status: 'QUEUED', error: null });
        }
    } else {
        const effectiveChannels = channelIds.length
            ? channelIds
            : await fallbackChannelIds(tx, workspaceId);

        // Mesmo produto cartesiano do CONTENT_PIECES — o prompt tem de saber
        // para que canal está a ser escrito, senão nasce um prompt que não
        // respeita as regras da plataforma (é o bug outra vez, um passo antes).
        for (const format of params.formats) {
            assertFormat(format);
            for (const channelId of effectiveChannels) {
                const pieceId = await createPlaceholderPiece(tx, {
                    workspaceId,
                    articleId: params.articleId,
                    productId: params.productId,
                    channelId,
                    format: format as ContentFormat,
                    pillar,
                    title: 'A escrever prompt…',
                    status: 'PROMPT_READY',
                    now,
                });
                items.push({
                    format: itemKey(format as ContentFormat, channelId),
                    targetId: pieceId,
                    status: 'QUEUED',
                    error: null,
                });
            }
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

// -----------------------------------------------------------------------------
// ARTICLE_METADATA — não cria placeholder: o artigo JÁ existe. Só valida o
// âmbito e monta um `item` por campo pedido (o `format` do item é o nome do
// campo), que é o que dá ao painel o estado independente por campo.
// -----------------------------------------------------------------------------

async function enqueueArticleMetadata(
    tx: Tx,
    args: {
        workspaceId: string;
        params: ArticleMetadataJobParams;
        now: Date;
    }
): Promise<{ targetId: string; items: GenerationJobItem[] }> {
    const { workspaceId, params } = args;

    const article = await tx.article.findFirst({
        where: { id: params.articleId, workspaceId },
        select: { id: true },
    });
    if (!article) {
        throw new EnqueueError(
            'Artigo não encontrado neste workspace.',
            'ARTICLE_NOT_FOUND'
        );
    }

    // `fields` não pode vir vazio nem com campos desconhecidos: o zod do
    // endpoint já o garante, mas o enqueue também é chamado pelos scripts de
    // probe e por qualquer outro caller futuro.
    const seen = new Set<string>();
    const fields = params.fields.filter((f) => {
        if (!METADATA_FIELDS.includes(f) || seen.has(f)) return false;
        seen.add(f);
        return true;
    });

    return {
        targetId: article.id,
        items: fields.map((field) => ({
            format: field,
            targetId: article.id,
            status: 'QUEUED',
            error: null,
        })),
    };
}

// -----------------------------------------------------------------------------
// MEDIA_PROMPT — escreve os prompts portáteis de media.
//
// Não cria placeholder: o ARTIGO ou a PEÇA já existe (é o próprio job de conteúdo
// que disparou este). Só valida o âmbito e monta um `item` por modalidade — o
// `runMediaPrompt` emparelha cada uma com os assuntos (slides/cenas/marcadores)
// quando corre.
// -----------------------------------------------------------------------------

async function enqueueMediaPrompt(
    tx: Tx,
    args: {
        workspaceId: string;
        params: MediaPromptJobParams;
        now: Date;
    }
): Promise<{ targetId: string; items: GenerationJobItem[] }> {
    const { workspaceId, params } = args;

    if (params.targetType === 'ARTICLE') {
        const article = await tx.article.findFirst({
            where: { id: params.targetId, workspaceId },
            select: { id: true },
        });
        if (!article) {
            throw new EnqueueError(
                'Artigo não encontrado neste workspace.',
                'ARTICLE_NOT_FOUND'
            );
        }
        return {
            targetId: article.id,
            items: params.modalities.map((modality) => ({
                format: modality,
                targetId: article.id,
                status: 'QUEUED',
                error: null,
            })),
        };
    }

    const piece = await tx.contentPiece.findFirst({
        where: { id: params.targetId, workspaceId },
        select: { id: true },
    });
    if (!piece) {
        throw new EnqueueError('Peça não encontrada.', 'TARGET_NOT_FOUND');
    }

    return {
        targetId: piece.id,
        items: params.modalities.map((modality) => ({
            format: modality,
            targetId: piece.id,
            status: 'QUEUED',
            error: null,
        })),
    };
}

// -----------------------------------------------------------------------------
// MEDIA_ARTIFACT — gera o FICHEIRO a partir de um prompt guardado.
//
// Cria a linha em `content_assets` em PENDING ANTES de o job correr, e é isso
// que dá ao dispatcher um sítio onde escrever o progresso: um duplo clique
// encontra a linha e não enfileira dois jobs, e o painel mostra "a gerar" durante
// o polling do `veo-3`, que pode demorar minutos.
// -----------------------------------------------------------------------------

async function enqueueMediaArtifact(
    tx: Tx,
    args: {
        workspaceId: string;
        params: MediaArtifactJobParams;
        now: Date;
    }
): Promise<{ targetId: string; items: GenerationJobItem[] }> {
    const { workspaceId, params } = args;

    const prompt = await tx.contentMediaPrompt.findFirst({
        where: { id: params.mediaPromptId, workspaceId },
    });
    if (!prompt) {
        throw new EnqueueError('Prompt de media não encontrado.', 'PROMPT_NOT_FOUND');
    }

    const asset = await tx.contentAsset.findFirst({
        where: { id: params.assetId, workspaceId },
        select: { id: true, status: true },
    });

    // Já está a gerar ou pronto: um duplo clique no botão não deve pagar duas
    // chamadas. O job termina aqui como concluído.
    if (asset && asset.status !== 'PENDING' && asset.status !== 'FAILED') {
        return {
            targetId: prompt.id,
            items: [
                {
                    format: prompt.modality,
                    targetId: prompt.id,
                    status: 'COMPLETED',
                    error: null,
                },
            ],
        };
    }

    // A linha em PENDING é criada AQUI, dentro da transacção do enqueue — e não
    // pelo cliente. Criá-la no browser deixaria uma janela entre o clique e o
    // insert em que dois cliques enfileiravam dois jobs (e duas chamadas pagas),
    // e um `MEDIA_ARTIFACT` órfão ficaria sem sítio onde mostrar "a gerar".
    const assetId = params.assetId || randomUUID();
    await tx.contentAsset.upsert({
        where: { id: assetId },
        create: {
            id: assetId,
            workspaceId,
            targetType: prompt.targetType,
            targetId: prompt.targetId,
            // `url` é NOT NULL no schema, mas uma linha em PENDING ainda não
            // tem ficheiro — a string vazia é o marcador temporário e o job
            // substitui-a pelo URL público assim que o upload termina.
            url: '',
            name: null,
            mimeType: null,
            source: 'GENERATED',
            status: 'PENDING',
            error: null,
            itemKey: prompt.itemKey,
            mediaPromptId: prompt.id,
            createdAt: args.now,
        },
        // Uma linha PENDING/FAILED existente é reutilizada (retry) — reescreve
        // o estado sem perder o `mediaPromptId` nem o `itemKey`.
        update: {
            source: 'GENERATED',
            status: 'PENDING',
            error: null,
            itemKey: prompt.itemKey,
            mediaPromptId: prompt.id,
        },
    });

    return {
        targetId: prompt.id,
        items: [
            {
                format: prompt.modality,
                targetId: prompt.id,
                status: 'QUEUED',
                error: null,
            },
        ],
    };
}
