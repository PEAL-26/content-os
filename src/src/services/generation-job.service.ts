import { getAccessToken, supabase } from '@/lib/supabase';
import { createJobsChannelRegistry } from '@/services/generation-jobs-channel';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
    GenerationJob,
    GenerationJobParams,
    GenerationJobStatusValue,
    GenerationJobTypeValue,
    TargetMode,
} from '@/lib/ai/generation-job-types';

// =============================================================================
// Generation jobs —- leitura de estado da geração assíncrona (Inngest).
// A tabela `generation_jobs` é lida diretamente via supabase (RLS desligado).
// Escrita: o job server-side usa Prisma; aqui só fazemos enqueue (POST) e
// leitura/subscrição de estado.
// =============================================================================

export type {
    ArticleMetadataJobParams,
    GenerationJob,
    GenerationJobItem,
    GenerationJobParams,
    GenerationJobStatusValue,
    GenerationJobTypeValue,
    MetadataField,
    TargetMode,
} from '@/lib/ai/generation-job-types';

export interface EnqueueGenerationInput {
    workspaceId: string;
    jobType: GenerationJobTypeValue;
    params: GenerationJobParams;
    /** Retry: reutilizar estes targets em vez de criar novos placeholders. */
    targets?: Array<{ format: string; targetId: string; mode?: TargetMode }>;
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

// -----------------------------------------------------------------------------
// Realtime — UM canal para `generation_jobs`, muitos listeners.
//
// O registry (canal partilhado + ref-count) vive em `generation-jobs-channel.ts`
// e é injectado aqui. Não é abstracção gratuitária: `supabase.channel(topic)`
// devolve o canal já existente quando o topic repete, e o `.on()` de um canal
// já *joined* atira — com dois subscritores do mesmo alvo (a página de peças
// tinha dois) isso crashava a app toda. Diagnóstico completo no registry.
// -----------------------------------------------------------------------------

const jobsChannel = createJobsChannelRegistry<GenerationJob>({
    channel: (topic) => supabase.channel(topic),
    // O canal chega aqui já tipado pelo registry (ver `JobsChannelFactory`).
    removeChannel: (channel) =>
        supabase.removeChannel(channel as RealtimeChannel),
});

export const generationJobService = {
    /**
     * Cria o job + placeholders no servidor e devolve { jobId, targetId } para
     * a UI navegar logo para o alvo (o estado chega via Realtime).
     */
    async enqueue(
        input: EnqueueGenerationInput
    ): Promise<EnqueueGenerationResult> {
        // O endpoint valida o JWT (verifyAuth) em produção, por isso o token tem
        // de ir no header — sem ele devolvia 401 "Sem token de autenticação.".
        // Não tratamos a falta de token como erro aqui: o pedido segue sem
        // header e o 401 do servidor é a resposta correcta, acabada em
        // `toJobError` como os restantes.
        const token = await getAccessToken();

        const res = await fetch('/api/ai/enqueue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
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
     * Subscreve a um job específico (match por `job.id`).
     * Devolve a função para remover a subscrição.
     */
    subscribeToJob(
        jobId: string,
        onChange: (job: GenerationJob) => void
    ): () => void {
        return jobsChannel.subscribe((job) => job.id === jobId, onChange);
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
        const ids = new Set(targetIds);
        return jobsChannel.subscribe(
            (job) => !!job.targetId && ids.has(job.targetId),
            onChange
        );
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
        case 'CONTENT_PROMPT':
            return { articleId: '', formats: [] };
        case 'VIDEO_SCRIPT':
            return { articleId: '', targetChannel: 'TIKTOK', durationSec: 60 };
        case 'CONTENT_ITEM':
            return { pieceId: '', itemKey: 'main' };
        case 'ARTICLE_METADATA':
            return { articleId: '', fields: [] };
    }
}

export function isGenerationJobActive(
    status: GenerationJobStatusValue | undefined
): boolean {
    return status === 'QUEUED' || status === 'RUNNING';
}