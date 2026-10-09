import { prisma } from '../../src/lib/prisma.js';
import type { GenerationJobItem } from './types.js';

// =============================================================================
// Job store — acesso Prisma a generation_jobs (CRUD usado pelo job Inngest).
// A escrita de placeholders + job acontece no enqueue (transação única).
// =============================================================================

export type JobWithItems = Awaited<
    ReturnType<typeof prisma.generationJob.findUnique>
> & { itemsJson: GenerationJobItem[] | null };

/** A linha de `generation_jobs` como os runners a usam. */
/**
 * A linha de `generation_jobs` como os runners a usam.
 *
 * O `getJob` devolve a linha crua (sem `itemsJson`, que é um campo virtual do
 * `JobWithItems`), por isso o tipo é derivado de `findUnique` directamente.
 */
export type JobRow = NonNullable<Awaited<ReturnType<typeof getJob>>>;

/** Lê um job (raw). */
export async function getJob(jobId: string) {
    return prisma.generationJob.findUnique({ where: { id: jobId } });
}

/** Marca o job como RUNNING com o run id do Inngest. */
export async function markJobRunning(
    jobId: string,
    runId: string
): Promise<void> {
    await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', runId, error: null, updatedAt: new Date() },
    });
}

/** Conclui o job com o estado dos items (por item) e erro global opcional. */
export async function markJobCompleted(
    jobId: string,
    items?: GenerationJobItem[]
): Promise<void> {
    await prisma.generationJob.update({
        where: { id: jobId },
        data: {
            status: 'COMPLETED',
            error: null,
            ...(items ? { items: items as unknown as object } : {}),
            updatedAt: new Date(),
        },
    });
}

/** Marca o job como FAILED com o motivo (visível na UI). */
export async function markJobFailed(
    jobId: string,
    error: string,
    items?: GenerationJobItem[]
): Promise<void> {
    await prisma.generationJob.update({
        where: { id: jobId },
        data: {
            status: 'FAILED',
            error,
            ...(items ? { items: items as unknown as object } : {}),
            updatedAt: new Date(),
        },
    });
}

/** Atualiza apenas o estado por item (batches de CONTENT_PIECES). */
export async function updateJobItems(
    jobId: string,
    items: GenerationJobItem[]
): Promise<void> {
    await prisma.generationJob.update({
        where: { id: jobId },
        data: { items: items as unknown as object, updatedAt: new Date() },
    });
}

/**
 * Guarda (substituindo) os prompts portáteis de uma peça/roteiro.
 *
 * `preserveItemKeys` são as chaves que não devem ser tocadas — usadas quando a
 * peça foi gerada a partir de um prompt pré-escrito ('main'): o prompt do
 * utilizador é a fonte da verdade e o delete+insert não pode apagá-lo.
 */
export async function saveGenerationPrompts(
    targetType: 'PIECE',
    targetId: string,
    items: Array<{ itemKey: string; prompt: string }>,
    preserveItemKeys: string[] = []
): Promise<void> {
    if (items.length === 0) return;

    // Numa transacção: o índice único (targetType, targetId, itemKey) garante
    // um prompt por item, mas sem atomicidade um delete seguido de um insert que
    // falhe deixaria a peça sem prompt nenhum.
    await prisma.$transaction([
        prisma.contentGenerationPrompt.deleteMany({
            where: {
                targetType,
                targetId,
                ...(preserveItemKeys.length > 0
                    ? { itemKey: { notIn: preserveItemKeys } }
                    : {}),
            },
        }),
        // `editedAt` fica a NULL: prompts reconstruídos pela IA não são
        // edições manuais, e é isso que a UI confirma antes de substituir.
        prisma.contentGenerationPrompt.createMany({
            data: items.map((item) => ({
                targetType,
                targetId,
                itemKey: item.itemKey,
                prompt: item.prompt,
                createdAt: new Date(),
            })),
        }),
    ]);
}

/** Lê todos os prompts de uma peça/roteiro. */
export async function getGenerationPrompts(
    targetType: 'PIECE',
    targetId: string
): Promise<
    Array<{
        itemKey: string | null;
        prompt: string;
        editedAt: Date | null;
    }>
> {
    return prisma.contentGenerationPrompt.findMany({
        where: { targetType, targetId },
        select: { itemKey: true, prompt: true, editedAt: true },
        orderBy: { createdAt: 'asc' },
    });
}

/** Lê o prompt de um item específico (null se não existir). */
export async function getGenerationPrompt(
    targetType: 'PIECE',
    targetId: string,
    itemKey: string
): Promise<string | null> {
    const row = await prisma.contentGenerationPrompt.findFirst({
        where: { targetType, targetId, itemKey },
        select: { prompt: true },
    });
    return row?.prompt ?? null;
}

/**
 * Actualiza o prompt de um item sem tocar nos restantes, marcando-o como
 * editado à mão. Devolve false se o prompt não existir (o caller decide).
 */
export async function updateGenerationPrompt(
    targetType: 'PIECE',
    targetId: string,
    itemKey: string,
    prompt: string
): Promise<boolean> {
    const { count } = await prisma.contentGenerationPrompt.updateMany({
        where: { targetType, targetId, itemKey },
        data: { prompt, editedAt: new Date() },
    });
    return count > 0;
}

/** Copia todos os prompts de um target para outro (nova versão da peça). */
export async function copyGenerationPrompts(
    targetType: 'PIECE',
    fromTargetId: string,
    toTargetId: string
): Promise<void> {
    const rows = await prisma.contentGenerationPrompt.findMany({
        where: { targetType, targetId: fromTargetId },
        select: { itemKey: true, prompt: true, providerId: true, modelCode: true },
    });
    if (rows.length === 0) return;

    const now = new Date();
    await prisma.contentGenerationPrompt.createMany({
        data: rows.map((row) => ({
            targetType,
            targetId: toTargetId,
            itemKey: row.itemKey,
            prompt: row.prompt,
            providerId: row.providerId,
            modelCode: row.modelCode,
            createdAt: now,
        })),
    });
}