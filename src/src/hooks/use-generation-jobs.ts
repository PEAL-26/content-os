import {
    generationJobService,
    isGenerationJobActive,
    type GenerationJob,
    type GenerationJobTypeValue,
} from '@/services/generation-job.service';
import { useCallback, useEffect, useMemo, useState } from 'react';

// =============================================================================
// Estado dos jobs de vários alvos de uma vez (listagens). Consulta o job mais
// recente por target + Realtime (targetId=in.(...)) + poll de ~10s enquanto
// existir um job ativo. Devolve um mapa targetId → job.
// =============================================================================

export interface UseGenerationJobsForTargetsResult {
    /** Último job conhecido por targetId (apenas os que têm job). */
    jobsByTarget: Record<string, GenerationJob>;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

const POLL_MS = 10_000;

export function useGenerationJobsForTargets(
    jobType: GenerationJobTypeValue,
    targetIds: string[],
    options?: { enabled?: boolean }
): UseGenerationJobsForTargetsResult {
    const enabled = options?.enabled ?? true;
    const [jobsByTarget, setJobsByTarget] = useState<
        Record<string, GenerationJob>
    >({});
    const [isLoading, setIsLoading] = useState(false);

    // Identidade estável da lista de targets (evita re-fetches por novo array).
    const idsKey = targetIds.join('|');

    const hasActive = useMemo(
        () =>
            Object.values(jobsByTarget).some((j) =>
                isGenerationJobActive(j.status)
            ),
        [jobsByTarget]
    );

    const fetchJobs = useCallback(async () => {
        const ids = enabled ? targetIds : [];
        if (ids.length === 0) {
            setJobsByTarget({});
            return;
        }
        try {
            const map = await generationJobService.getLatestJobsForTargets(
                jobType,
                ids
            );
            setJobsByTarget(map);
        } catch {
            // Silencioso — o poll repete e o Realtime cobre.
        }
        // targetIds identidade instável: usar idsKey em vez do array.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobType, idsKey, enabled]);

    // Fetch inicial / quando a lista de targets muda.
    useEffect(() => {
        setIsLoading(true);
        void fetchJobs().finally(() => setIsLoading(false));
    }, [fetchJobs]);

    // Realtime por conjunto de targets (apanha novos jobs e atualizações).
    useEffect(() => {
        if (!enabled || targetIds.length === 0) return undefined;
        const unsub = generationJobService.subscribeToTargets(
            targetIds,
            (job) => {
                if (job.jobType !== jobType) return;
                const targetId = job.targetId ?? '';
                if (!targetId) return;
                setJobsByTarget((prev) => {
                    const existing = prev[targetId];
                    if (existing && job.createdAt < existing.createdAt) {
                        return prev;
                    }
                    return { ...prev, [targetId]: job };
                });
            }
        );
        return unsub;
        // targetIds identidade instável: usar idsKey em vez do array.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobType, idsKey, enabled]);

    // Poll ~10s apenas enquanto existir um job ativo (fallback ao Realtime).
    useEffect(() => {
        if (!hasActive) return undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const tick = () => {
            timeoutId = setTimeout(() => {
                void fetchJobs();
                tick();
            }, POLL_MS);
        };
        tick();
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [hasActive, fetchJobs]);

    const refresh = useCallback(async () => {
        await fetchJobs();
    }, [fetchJobs]);

    return { jobsByTarget, isLoading, refresh };
}