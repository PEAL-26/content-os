import { create } from 'zustand';
import type { GenerationJobTypeValue } from '@/services/generation-job.service';

// =============================================================================
// Memória mínima dos jobs enqueueados: ao navegar logo para o alvo (artigo,
// peças, roteiro), a UI pode iniciar a subscrição pelo jobId sem esperar pelo
// primeiro fetch de "último job do target". O hook usa isto como "seed" e
// faz o sanity poll para apanhar cases de recarregamento/retry.
// =============================================================================

type JobKey = string; // `${jobType}:${targetId}`

interface GenerationJobsState {
    /** jobId por `jobType:targetId` (só o mais recente conhecido). */
    jobsByKey: Record<JobKey, string>;
    rememberJob: (args: {
        jobType: GenerationJobTypeValue;
        targetId: string;
        jobId: string;
    }) => void;
    forgetTarget: (args: {
        jobType: GenerationJobTypeValue;
        targetId: string;
    }) => void;
}

export function generationJobKey(
    jobType: GenerationJobTypeValue,
    targetId: string
): JobKey {
    return `${jobType}:${targetId}`;
}

export const useGenerationJobStore = create<GenerationJobsState>((set) => ({
    jobsByKey: {},
    rememberJob: ({ jobType, targetId, jobId }) =>
        set((state) => ({
            jobsByKey: {
                ...state.jobsByKey,
                [generationJobKey(jobType, targetId)]: jobId,
            },
        })),
    forgetTarget: ({ jobType, targetId }) =>
        set((state) => {
            const key = generationJobKey(jobType, targetId);
            const next = { ...state.jobsByKey };
            delete next[key];
            return { jobsByKey: next };
        }),
}));