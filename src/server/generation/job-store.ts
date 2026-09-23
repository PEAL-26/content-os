import { prisma } from '../../src/lib/prisma';
import type { GenerationJobItem } from './types';

// =============================================================================
// Job store — acesso Prisma a generation_jobs (CRUD usado pelo job Inngest).
// A escrita de placeholders + job acontece no enqueue (transação única).
// =============================================================================

export type JobWithItems = Awaited<
    ReturnType<typeof prisma.generationJob.findUnique>
> & { itemsJson: GenerationJobItem[] | null };

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

/** Guarda (substituindo) os prompts portáteis de uma peça/roteiro. */
export async function saveGenerationPrompts(
    targetType: 'PIECE' | 'VIDEO_SCRIPT',
    targetId: string,
    items: Array<{ itemKey: string; prompt: string }>
): Promise<void> {
    await prisma.contentGenerationPrompt.deleteMany({
        where: { targetType, targetId },
    });
    if (items.length === 0) return;

    await prisma.contentGenerationPrompt.createMany({
        data: items.map((item) => ({
            targetType,
            targetId,
            itemKey: item.itemKey,
            prompt: item.prompt,
            createdAt: new Date(),
        })),
    });
}