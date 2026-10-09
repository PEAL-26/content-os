import { prisma } from '../../src/lib/prisma.js';
import {
    MEDIA_PROMPT_CONTENT_TYPES,
    buildMediaPromptSystemPrompt,
    buildMediaPromptUserPrompt,
    parseMediaPromptResponse,
    type MediaSubject,
} from '../../src/lib/ai/media-prompts.js';
import {
    generateWithFallback,
    getAvailableProvidersFromStore,
} from '../../src/lib/ai/provider.js';
import { resolveMediaModel } from '../media/dispatcher.js';
import { MediaAdapterError, type MediaResult } from '../media/types.js';
import { loadGenerationContext, resolveSystemPrompt } from './context.js';
import {
    aspectRatioForTarget,
    loadMediaSource,
    mediaPromptParamsFor,
    subjectsFor,
    type MediaTarget,
} from './media-source.js';
import { createServerTransport } from './transport.js';
import type { JobRow, LoadedGenerationContext } from './types.js';

/**
 * Item de um job de MEDIA: o par (modalidade, assunto) é o que dá estado
 * independente por prompt na UI.
 */
export interface GeneratedMediaItem {
    modality: MediaModalityValue;
    subject: MediaSubject;
    status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
    error: string | null;
    mediaPromptId: string | null;
}

// =============================================================================
// MEDIA_PROMPT / MEDIA_ARTIFACT
//
// Separação deliberada (Decisão 8 e 27):
//   · o PROMPT corre automaticamente depois de a peça existir — é barato, é uma
//     chamada de texto, e é o que o utilizador precisa para poder gerar o
//     ficheiro em qualquer ferramenta, mesmo sem ter modelo configurado;
//   · o ARTEFACTO só corre depois de confirmação com o custo estimado à vista.
//     Vídeo a ~$0,75/segundo não é uma chamada que se dispare sozinha.
// =============================================================================

const MEDIA_PROMPT_TIMEOUT_MS = 120_000;

/** As três modalidades que o registry de media conhece. */
export const MEDIA_MODALITIES = ['image', 'audio', 'video'] as const;
export type MediaModalityValue = (typeof MEDIA_MODALITIES)[number];

/** Type guard das três modalidades, para dados vindos de JSON colunado. */
export function isMediaModality(value: string): value is MediaModalityValue {
    return (MEDIA_MODALITIES as readonly string[]).includes(value);
}

/**
 * Gera e grava um prompt de media para (alvo, modalidade, itemKey).
 *
 * Não escreve nada quando o modelo não devolve um prompt usável, e — salvo
 * `overwrite` — não toca num prompt que já existe, porque esse pode ter sido
 * editado à mão pelo utilizador.
 */
async function generateAndSaveMediaPrompt(args: {
    ctx: LoadedGenerationContext;
    target: MediaTarget;
    modality: MediaModalityValue;
    subject: MediaSubject;
    aspectRatio: string | null;
    overwrite?: boolean;
    workspace: Parameters<typeof buildMediaPromptUserPrompt>[1]['workspace'];
    /** Artigo/produto/pilar — `null` quando o alvo não os tem. */
    content: Omit<
        Parameters<typeof buildMediaPromptUserPrompt>[1],
        'workspace'
    >;
}): Promise<string | null> {
    const { ctx, target, modality, subject, aspectRatio, overwrite, workspace, content } = args;

    const where = {
        targetType_targetId_modality_itemKey: {
            targetType: target.targetType,
            targetId: target.targetId,
            modality,
            itemKey: subject.itemKey,
        },
    };

    if (!overwrite) {
        const existing = await prisma.contentMediaPrompt.findUnique({
            where,
            select: { id: true },
        });
        // Já existe — e `editedAt`filled significa que o utilizador lhe mexeu.
        return existing?.id ?? null;
    }

    const systemPrompt = await resolveSystemPrompt(
        ctx.workspaceId,
        undefined,
        MEDIA_PROMPT_CONTENT_TYPES[modality],
        () => buildMediaPromptSystemPrompt(modality, { workspace: ctx.workspace })
    );

    const result = await generateWithFallback<{
        prompt: string;
        negativePrompt?: string | null;
    }>({
        providers: getAvailableProvidersFromStore(ctx.providers, ctx.apiKeys),
        apiKeys: ctx.apiKeys,
        preferred: ctx.defaultPreferred,
        buildSystem: () => systemPrompt,
        buildPrompt: () =>
            buildMediaPromptUserPrompt(
                modality,
                { workspace, ...content },
                subject
            ),
        parse: (text) => parseMediaPromptResponse(modality, text),
        maxAttempts: 2,
        transport: createServerTransport(MEDIA_PROMPT_TIMEOUT_MS),
    });

    if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'A IA não devolveu um prompt válido.');
    }

    const row = await prisma.contentMediaPrompt.upsert({
        where,
        create: {
            workspaceId: ctx.workspaceId,
            targetType: target.targetType,
            targetId: target.targetId,
            modality,
            itemKey: subject.itemKey,
            prompt: result.data.prompt,
            negativePrompt: result.data.negativePrompt,
            aspectRatio,
        },
        update: {
            prompt: result.data.prompt,
            negativePrompt: result.data.negativePrompt,
            aspectRatio,
            // `editedAt: null` marca "isto passou a ser gerado, não escrito à
            // mão" — o que o painel usa para mostrar "editado".
            editedAt: null,
        },
    });

    return row.id;
}

/**
 * MEDIA_PROMPT job — um item por (modalidade, assunto).
 *
 * O `items` do job dá estado independente por prompt: um slide que falhe não
 * impede os outros de ficarem prontos.
 */
export async function runMediaPrompt(
    job: JobRow,
    params: {
        targetId: string;
        targetType: 'ARTICLE' | 'PIECE';
        modalities: string[];
        overwrite?: boolean;
        preferred?: { providerId?: string | null; modelCode?: string | null } | null;
    },
    items: GeneratedMediaItem[]
): Promise<void> {
    const ctx = await loadGenerationContext(job.workspaceId, job.userId);

    const target: MediaTarget = {
        targetType: params.targetType,
        targetId: params.targetId,
    };

    const source = await loadMediaSource(target);
    if (!source) {
        await markJobFailed(job, 'O conteúdo de destino já não existe.', items);
        return;
    }

    const subjects = subjectsFor(target, source);
    // O filtro é o que garante a tipo: `params.modalities` vem de JSON colunado e
    // pode trazer lixo de um job antigo.
    const modalities = params.modalities.filter(isMediaModality);

    if (subjects.length === 0 || modalities.length === 0) {
        await markJobCompleted(job, items);
        return;
    }

    const aspectRatio = await aspectRatioForTarget(source.channelId);
    const content = await mediaPromptParamsFor(source);

    /**
     * A fila de (modalidade, assunto).
     *
     * O `items` do job é um item por MODALIDADE (o que o enqueue consegue saber
     * antes de ler o conteúdo) — mas o número real de prompts depende dos slides,
     * cenas ou marcadores do artigo, que só aqui se descobre. Por isso a fila
     * vem dos params, e o `items` é reescrito no fim com o estado por prompt.
     */
    const running: GeneratedMediaItem[] = modalities.flatMap((modality) =>
        subjects.map((subject) => ({
            modality,
            subject,
            status: 'QUEUED' as const,
            error: null,
            mediaPromptId: null,
        }))
    );

    // Sequencial: cada prompt é uma chamada de texto (barata mas não grátis), e
    // num carrossel de 10 slides × 2 modalidades já são 20 chamadas. Subir isto
    // a pLimit subiria a factura sem o utilizador ter pedido nada.
    for (const entry of running) {
        entry.status = 'RUNNING';
        try {
            const id = await generateAndSaveMediaPrompt({
                ctx,
                target,
                modality: entry.modality,
                subject: entry.subject,
                aspectRatio,
                overwrite: params.overwrite,
                workspace: ctx.workspace,
                content,
            });
            entry.mediaPromptId = id;
            // `id: null` = o prompt já existia e foi preservado (não foi gerado).
            entry.status = id ? 'COMPLETED' : 'SKIPPED';
            entry.error = null;
        } catch (error) {
            entry.status = 'FAILED';
            entry.error =
                error instanceof Error ? error.message : 'Erro a gerar o prompt.';
        }
        await persistItems(job, running);
    }

    const failed = running.filter((i) => i.status === 'FAILED');
    const done = running.filter((i) => i.status === 'COMPLETED' || i.status === 'SKIPPED');

    // Um job só falha se NENHUM prompt ficou utilizável — uma falha parcial é um
    // job concluído com items a falhar, para o painel só oferecer "Repetir"
    // nesses (mesmo critério do CONTENT_PIECES).
    if (failed.length > 0 && done.length === 0) {
        await markJobFailed(
            job,
            failed[0]?.error ?? 'Nenhum prompt de media foi gerado.',
            running
        );
        return;
    }

    await markJobCompleted(job, running);
}

/**
 * Regenera os prompts de media de UM item (chamado pelo CONTENT_ITEM).
 *
 * Silencioso em caso de falha: isto é uma melhoria secundária de um item que já
 * foi gerado com sucesso, e não deve fazer o CONTENT_ITEM inteiro falhar.
 */
export async function regenerateMediaPromptsForItem(args: {
    workspaceId: string;
    targetType: 'ARTICLE' | 'PIECE';
    targetId: string;
    itemKey: string;
    /**
     * Regenerar também o FICHEIRO (Decisão 30). É uma chamada paga, por isso
     * o cliente desliga-o por omissão e só o liga quando o/utilizador pediu.
     */
    regenerateArtifact?: boolean;
}): Promise<void> {
    try {
        const ctx = await loadGenerationContext(args.workspaceId);
        const target: MediaTarget = {
            targetType: args.targetType,
            targetId: args.targetId,
        };

        const source = await loadMediaSource(target);
        if (!source) return;

        const subject = subjectsFor(target, source).find(
            (s) => s.itemKey === args.itemKey
        );
        if (!subject) return;

        const aspectRatio = await aspectRatioForTarget(source.channelId);
        const content = await mediaPromptParamsFor(source);

        for (const modality of MEDIA_MODALITIES) {
            const promptId = await generateAndSaveMediaPrompt({
                ctx,
                target,
                modality,
                subject,
                aspectRatio,
                // `overwrite`: o texto do item mudou, o prompt antigo já não
                // o descreve. Sem isto, o prompt continuaria a descrever o
                // slide antigo — que já não existe.
                overwrite: true,
                workspace: ctx.workspace,
                content,
            });
            if (!promptId) continue;

            // Decisão 30: regenerar o item regenera também a IMAGEM.
            // `promptId: null` significa que o prompt já existia e foi
            // preservado (não foi gerado) — nesse caso não há nada novo a
            // ilustrar e não vale a pena pagar outra chamada.
            if (!args.regenerateArtifact) continue;
            if (!await artifactForItemExists(promptId)) {
                await enqueueArtifactForPrompt(args.workspaceId, promptId);
            }
        }
    } catch (error) {
        console.warn(
            '[media] não foi possível regenerar o prompt de media do item:',
            error instanceof Error ? error.message : error
        );
    }
}

/**
 * Já existe um ficheiro pronto para este prompt?
 *
 * É o que evita pagar de novo pela imagem de um slide que o utilizador já
 * tinha gerado: a regeneração do TEXTO não implica necessariamente gerar o
 * ficheiro de novo.
 */
async function artifactForItemExists(
    mediaPromptId: string
): Promise<boolean> {
    const count = await prisma.contentAsset.count({
        where: { mediaPromptId, status: 'READY' },
    });
    return count > 0;
}

/**
 * Enfileira o `MEDIA_ARTIFACT` de um prompt.
 *
 * Cria a linha `content_assets` em PENDING via o enqueue (é o enqueue que a cria
 * dentro da transacção — ver `enqueueMediaArtifact`), e envia o evento de media
 * para o job arrancar com o timeout próprio do Veo.
 */
async function enqueueArtifactForPrompt(
    workspaceId: string,
    mediaPromptId: string
): Promise<void> {
    const { enqueueGeneration } = await import('./enqueue.js');
    const { sendMediaRequested } = await import('./inngest.js');

    const created = await enqueueGeneration({
        workspaceId,
        jobType: 'MEDIA_ARTIFACT',
        params: { mediaPromptId, assetId: '' },
    });

    await sendMediaRequested(created.jobId);
}

// -----------------------------------------------------------------------------
// MEDIA_ARTIFACT
// -----------------------------------------------------------------------------

/**
 * MEDIA_ARTIFACT job — gera o ficheiro a partir do prompt guardado.
 *
 * A linha em `content_assets` é criada em PENDING pelo enqueue, ANTES do job
 * arrancar. Duas consequências que importam:
 *   · um duplo clique encontra a linha e não enfileira dois jobs;
 *   · o painel tem onde mostrar "a gerar" enquanto o `veo-3` faz polling durante
 *     vários minutos.
 */
export async function runMediaArtifact(
    job: JobRow,
    params: {
        mediaPromptId: string;
        assetId: string;
        providerTechnicalId?: string | null;
        modelCode?: string | null;
    },
    items: GeneratedMediaItem[]
): Promise<void> {
    const ctx = await loadGenerationContext(job.workspaceId, job.userId);

    const prompt = await prisma.contentMediaPrompt.findUnique({
        where: { id: params.mediaPromptId },
    });
    if (!prompt) {
        await markJobFailed(job, 'O prompt de media já não existe.', items);
        return;
    }
    if (!isMediaModality(prompt.modality)) {
        await markJobFailed(job, `Modalidade desconhecida: ${prompt.modality}`, items);
        return;
    }

    await setAssetStatus(params.assetId, 'GENERATING', null);

    const resolution = await resolveArtifactModel(ctx, job.workspaceId, {
        modality: prompt.modality,
        providerTechnicalId: params.providerTechnicalId,
        modelCode: params.modelCode,
    });

    if (!resolution.candidate) {
        // O PROMPT SOBREVIVE. É a razão de esta feature existir: sem modelo
        // activo, o utilizador ainda pode gerar o ficheiro noutro sítio.
        const error =
            resolution.reason ??
            `Nenhum modelo activo gera ${prompt.modality}. O prompt ficou guardado para gerares noutro sítio.`;
        await setAssetStatus(params.assetId, 'FAILED', error);
        await markJobFailed(job, error, items);
        return;
    }

    let result: MediaResult;
    try {
        const { generateArtifact } = await import('../media/dispatcher.js');
        result = await generateArtifact({
            modality: prompt.modality,
            resolution,
            request: {
                prompt: prompt.prompt,
                negativePrompt: prompt.negativePrompt,
                aspectRatio: prompt.aspectRatio,
                language: (await languageFor(job.workspaceId)) ?? null,
            },
        });
    } catch (error) {
        const message =
            error instanceof MediaAdapterError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : 'Erro a gerar o ficheiro.';
        await setAssetStatus(params.assetId, 'FAILED', message);
        await markJobFailed(job, message, items);
        return;
    }

    const url = await uploadGeneratedMedia(job.workspaceId, result);
    if (!url) {
        const error =
            'O ficheiro foi gerado mas não foi possível guardá-lo. O prompt ficou guardado.';
        await setAssetStatus(params.assetId, 'FAILED', error);
        await markJobFailed(job, error, items);
        return;
    }

    await prisma.contentAsset.update({
        where: { id: params.assetId },
        data: {
            url,
            name: result.filename,
            mimeType: result.mimeType,
            status: 'READY',
            error: null,
            providerId: resolution.candidate.providerId,
            modelCode: resolution.candidate.modelCode,
        },
    });

    await markJobCompleted(job, items);
}

/** Candidatos de media, derivados dos providers activos do utilizador. */
async function resolveArtifactModel(
    ctx: LoadedGenerationContext,
    workspaceId: string,
    args: {
        modality: MediaModalityValue;
        providerTechnicalId?: string | null;
        modelCode?: string | null;
    }
): Promise<ReturnType<typeof resolveMediaModel>> {
    const { providers, apiKeys } = ctx;

    const candidates = providers
        .filter((provider) => provider.isActive && apiKeys[provider.id])
        .map((provider) => {
            const model = provider.models?.find(
                (m) =>
                    m.isActive &&
                    (!args.modelCode || m.modelCode === args.modelCode) &&
                    (!args.providerTechnicalId ||
                        provider.providerId === args.providerTechnicalId)
            );
            return {
                providerId: provider.id,
                providerTechnicalId: provider.providerId,
                modelCode: model?.modelCode ?? '',
                modalities: model?.modalities ?? [],
                isActive: Boolean(model),
                priority: provider.priority,
                apiKey: apiKeys[provider.id] ?? '',
                baseUrl: provider.baseUrl,
            };
        });

    return resolveMediaModel(args.modality, candidates, await artifactMapping(workspaceId));
}

async function artifactMapping(
    workspaceId: string
): Promise<{ image?: string | null; audio?: string | null; video?: string | null } | null> {
    const row = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { artifactModels: true },
    });
    const raw = row?.artifactModels;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    return {
        image: typeof record.image === 'string' ? record.image : null,
        audio: typeof record.audio === 'string' ? record.audio : null,
        video: typeof record.video === 'string' ? record.video : null,
    };
}

async function languageFor(workspaceId: string): Promise<string | null> {
    const row = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { contentLanguage: true },
    });
    return row?.contentLanguage ?? null;
}

/**
 * Upload para o bucket `generated`.
 *
 * Falhar aqui NÃO é falhar a geração: o prompt sobrevive intacto e o
 * utilizador pode gerar o ficheiro noutro sítio. Por isso o erro é registado e
 * a peça fica com `status: FAILED` + a explicação, em vez de o job rebentar.
 */
async function uploadGeneratedMedia(
    workspaceId: string,
    result: MediaResult
): Promise<string | null> {
    try {
        // Import estático (não dinâmico) e para o servidor de propósito: o
        // serviço de artefactos do browser usa `storage: localStorage`, que não
        // existe em Node.
        const { uploadGeneratedFile } = await import('../media/storage.js');
        return await uploadGeneratedFile(workspaceId, result);
    } catch (error) {
        console.warn(
            '[media] upload do ficheiro gerado falhou:',
            error instanceof Error ? error.message : error
        );
        return null;
    }
}

// -----------------------------------------------------------------------------
// Persistência de estado
// -----------------------------------------------------------------------------

async function setAssetStatus(
    assetId: string,
    status: 'PENDING' | 'GENERATING' | 'READY' | 'FAILED',
    error: string | null
): Promise<void> {
    await prisma.contentAsset
        .update({ where: { id: assetId }, data: { status, error } })
        .catch(() => {
            // O artefacto pode ter sido apagado pelo utilizador enquanto gerava.
            // Não é um erro do job — só não há onde mostrar o estado.
        });
}

async function persistItems(
    job: JobRow,
    items: GeneratedMediaItem[]
): Promise<void> {
    await prisma.generationJob.update({
        where: { id: job.id },
        data: {
            items: items as unknown as object,
            updatedAt: new Date(),
        },
    });
}

async function markJobCompleted(
    job: JobRow,
    items: GeneratedMediaItem[]
): Promise<void> {
    await prisma.generationJob.update({
        where: { id: job.id },
        data: {
            status: 'COMPLETED',
            items: items as unknown as object,
            updatedAt: new Date(),
        },
    });
}

async function markJobFailed(
    job: JobRow,
    error: string,
    items: GeneratedMediaItem[]
): Promise<void> {
    await prisma.generationJob.update({
        where: { id: job.id },
        data: {
            status: 'FAILED',
            error,
            items: items as unknown as object,
            updatedAt: new Date(),
        },
    });
}

