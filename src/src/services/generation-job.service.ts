import { supabase } from '@/lib/supabase';
import type {
    GenerationJob,
    GenerationJobParams,
    GenerationJobStatusValue,
    GenerationJobTypeValue,
} from '@/lib/ai/generation-job-types';

// =============================================================================
// Generation jobs —- leitura de estado da geração assíncrona (Inngest).
// A tabela `generation_jobs` é lida diretamente via supabase (RLS desligado).
// Escrita: o job server-side usa Prisma; aqui só fazemos enqueue (POST) e
// leitura/subscrição de estado.
// =============================================================================

export type {
    GenerationJob,
    GenerationJobItem,
    GenerationJobParams,
    GenerationJobStatusValue,
    GenerationJobTypeValue,
} from '@/lib/ai/generation-job-types';

export interface EnqueueGenerationInput {
    workspaceId: string;
    jobType: GenerationJobTypeValue;
    params: GenerationJobParams;
    /** Retry: reutilizar estes targets em vez de criar novos placeholders. */
    targets?: Array<{ format: string; targetId: string }>;
}

export interface EnqueueGenerationResult {
    jobId: string;
    targetId: string;
}

/** Erro de enqueue com código (ameia a UI a mapear NO_PROVIDER, etc.). */
export interface GenerationEnqueueError extends Error {
    code?: string;
    /** Presente quando o job já foi criado mesmo com o evento a falhar. */
    jobId?: string;
    targetId?: string;
}

function toJobError(payload: unknown): GenerationEnqueueError {
    const data = payload as {
        error?: string;
        code?: string;
        jobId?: string;
        targetId?: string;
    };
    const message =
        data?.error ?? 'Erro ao criar a geração em segundo plano.';
    const error = new Error(message) as GenerationEnqueueError;
    error.code = data?.code;
    error.jobId = data?.jobId;
    error.targetId = data?.targetId;
    return error;
}

function normalizeJob(row: Record<string, unknown> | null): GenerationJob | null {
    if (!row) return null;
    return row as unknown as GenerationJob;
}

export const generationJobService = {
    /**
     * Cria o job + placeholders no servidor e devolve { jobId, targetId } para
     * a UI navegar logo para o alvo (o estado chega via Realtime).
     */
    async enqueue(
        input: EnqueueGenerationInput
    ): Promise<EnqueueGenerationResult> {
        const res = await fetch('/api/ai/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobType: input.jobType,
                workspaceId: input.workspaceId,
                params: input.params,
                targets: input.targets,
            }),
        });

        const data = (await res.json().catch(() => ({}))) as unknown;
        if (!res.ok) {
            throw toJobError(data);
        }
        const ok = data as { jobId?: string; targetId?: string };
        if (!ok.jobId) {
            throw toJobError({ error: 'Resposta do servidor sem jobId.' });
        }
        return { jobId: ok.jobId, targetId: ok.targetId ?? '' };
    },

    /** Fetch inicial de um job. */
    async getJob(jobId: string): Promise<GenerationJob | null> {
        const { data, error } = await supabase
            .from('generation_jobs')
            .select('*')
            .eq('id', jobId)
            .maybeSingle();
        if (error) throw new Error(error.message);
        return normalizeJob(data as Record<string, unknown> | null);
    },

    /** Último job (por createdAt) de um par jobType+targetId. */
    async getLatestJobForTarget(
        jobType: GenerationJobTypeValue,
        targetId: string
    ): Promise<GenerationJob | null> {
        const { data, error } = await supabase
            .from('generation_jobs')
            .select('*')
            .eq('jobType', jobType)
            .eq('targetId', targetId)
            .order('createdAt', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw new Error(error.message);
        return normalizeJob(data as Record<string, unknown> | null);
    },

    /** Último job por target dentro de um conjunto (para listagens). */
    async getLatestJobsForTargets(
        jobType: GenerationJobTypeValue,
        targetIds: string[]
    ): Promise<Record<string, GenerationJob>> {
        if (targetIds.length === 0) return {};
        const { data, error } = await supabase
            .from('generation_jobs')
            .select('*')
            .eq('jobType', jobType)
            .in('targetId', targetIds)
            .order('createdAt', { ascending: false });
        if (error) throw new Error(error.message);

        // Mantém apenas o mais recente por targetId.
        const byTarget: Record<string, GenerationJob> = {};
        for (const row of data ?? []) {
            const job = normalizeJob(row as Record<string, unknown>);
            if (job && !byTarget[job.targetId ?? '']) {
                byTarget[job.targetId ?? ''] = job;
            }
        }
        return byTarget;
    },

    /**
     * Subscreve a um job específico (postgres_changes `id=eq.<jobId>`).
     * Devolve a função para remover a subscrição.
     */
    subscribeToJob(
        jobId: string,
        onChange: (job: GenerationJob) => void
    ): () => void {
        const channel = supabase
            .channel(`generation-job-${jobId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'generation_jobs',
                    filter: `id=eq.${jobId}`,
                },
                (payload) => {
                    onChange(payload.new as unknown as GenerationJob);
                }
            )
            .subscribe();
        return () => {
            void supabase.removeChannel(channel);
        };
    },

    /**
     * Subscreve a todos os jobs de um conjunto de targets (novos jobs e
     * atualizações). Devolve a função para remover a subscrição.
     */
    subscribeToTargets(
        targetIds: string[],
        onChange: (job: GenerationJob) => void
    ): () => void {
        if (targetIds.length === 0) return () => undefined;
        const channel = supabase
            .channel(`generation-jobs-${targetIds.join('-').slice(0, 90)}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'generation_jobs',
                    filter: `targetId=in.(${targetIds.join(',')})`,
                },
                (payload) => {
                    onChange(payload.new as unknown as GenerationJob);
                }
            )
            .subscribe();
        return () => {
            void supabase.removeChannel(channel);
        };
    },
};

/**
 * Fallback para retry quando o snapshot de params está vazio — mantém o job
 * válido para o zod server-side (na prática os params estão sempre presentes
 * porque o job foi criado pelo servidor com placeholders).
 */
export function defaultJobParams(
    jobType: GenerationJobTypeValue
): GenerationJobParams {
    switch (jobType) {
        case 'NEW_ARTICLE':
            return { topic: '' };
        case 'CONTENT_PIECES':
            return { articleId: '', formats: [] };
        case 'VIDEO_SCRIPT':
            return { articleId: '', targetChannel: 'TIKTOK', durationSec: 60 };
    }
}

export function isGenerationJobActive(
    status: GenerationJobStatusValue | undefined
): boolean {
    return status === 'QUEUED' || status === 'RUNNING';
}