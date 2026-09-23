import {
    generationJobService,
    isGenerationJobActive,
    type GenerationJob,
    type GenerationJobTypeValue,
} from '@/services/generation-job.service';
import { generationJobKey, useGenerationJobStore } from '@/stores/generation-jobs-store';
import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// Estado da geração assíncrona (Inngest): fetch inicial + Realtime +
// sanity poll de ~10s enquanto o job está ativo. Suporta duas origens:
//   { kind: 'id', jobId }        → um job específico (ex.: banner do editor)
//   { kind: 'target', jobType, targetId } → último job de um alvo (ex.: peças
//     de um artigo); segue automaticamente novos jobs (retry/regenerar).
// =============================================================================

export type GenerationJobSource =
    | { kind: 'id'; jobId: string }
    | { kind: 'target'; jobType: GenerationJobTypeValue; targetId: string };

export interface UseGenerationJobResult {
    job: GenerationJob | null;
    isLoading: boolean;
    isActive: boolean;
    /** Refetch manual (e, para target-kind, re-resolve o job mais recente). */
    refresh: () => Promise<void>;
}

const POLL_MS = 10_000;

export function useGenerationJob(
    source: GenerationJobSource | null | undefined
): UseGenerationJobResult {
    const fixedJobId = source?.kind === 'id' ? source.jobId : null;
    const targetJobType =
        source?.kind === 'target' ? source.jobType : null;
    const targetIdStr = source?.kind === 'target' ? source.targetId : null;
    const targetKey =
        targetJobType && targetIdStr
            ? generationJobKey(targetJobType, targetIdStr)
            : null;

    const rememberJob = useGenerationJobStore((s) => s.rememberJob);
    const [job, setJob] = useState<GenerationJob | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [resolvedId, setResolvedId] = useState<string | null>(null);

    const jobRef = useRef<GenerationJob | null>(null);
    jobRef.current = job;

    // ---------------------------------------------------------------
    // Resolve a origem: seed da memória (target-kind) ou jobId fixo.
    // ---------------------------------------------------------------
    useEffect(() => {
        if (fixedJobId) {
            setResolvedId(fixedJobId);
            return;
        }
        if (targetJobType && targetIdStr) {
            const remembered =
                useGenerationJobStore.getState().jobsByKey[targetKey ?? ''] ??
                null;
            setResolvedId(remembered);
            void (async () => {
                try {
                    const latest =
                        await generationJobService.getLatestJobForTarget(
                            targetJobType,
                            targetIdStr
                        );
                    if (latest) {
                        setResolvedId(latest.id);
                        rememberJob({
                            jobType: targetJobType,
                            targetId: targetIdStr,
                            jobId: latest.id,
                        });
                    }
                } catch {
                    // Silencioso — o poll/sanity repete e o Realtime cobre.
                }
            })();
        } else {
            setResolvedId(null);
        }
    }, [fixedJobId, targetKey, targetJobType, targetIdStr, rememberJob]);

    // ---------------------------------------------------------------
    // Fetch + Realtime + poll do job resolvido.
    // ---------------------------------------------------------------
    useEffect(() => {
        if (!resolvedId) {
            setJob(null);
            setIsLoading(false);
            return;
        }

        let disposed = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const load = async () => {
            try {
                const next = await generationJobService.getJob(resolvedId);
                if (!disposed && next) setJob(next);
            } catch {
                // Silencioso — o poll repete.
            } finally {
                if (!disposed) setIsLoading(false);
            }
        };

        setIsLoading(true);
        void load();

        const unsubJob = generationJobService.subscribeToJob(resolvedId, (next) => {
            if (!disposed) setJob(next);
        });

        // Poll de ~10s DENTRO de um job ativo (fallback ao Realtime).
        const tick = () => {
            timeoutId = setTimeout(() => {
                if (disposed) return;
                if (isGenerationJobActive(jobRef.current?.status)) {
                    void load();
                    tick();
                }
            }, POLL_MS);
        };
        tick();

        // Target-kind: apanha jobs novos (ex.: retry noutra aba) no mesmo alvo.
        const unsubTarget =
            targetJobType && targetIdStr
                ? generationJobService.subscribeToTargets(
                      [targetIdStr],
                      (next) => {
                          if (disposed) return;
                          if (next.id === resolvedId) {
                              setJob(next);
                              return;
                          }
                          const current = jobRef.current;
                          const isNewer =
                              !current || next.createdAt >= current.createdAt;
                          if (isNewer) {
                              setResolvedId(next.id);
                              rememberJob({
                                  jobType: targetJobType!,
                                  targetId: targetIdStr,
                                  jobId: next.id,
                              });
                          }
                      }
                  )
                : undefined;

        return () => {
            disposed = true;
            if (timeoutId) clearTimeout(timeoutId);
            unsubJob();
            unsubTarget?.();
        };
    }, [
        resolvedId,
        targetKey,
        targetJobType,
        targetIdStr,
        rememberJob,
    ]);

    const refresh = useCallback(async () => {
        if (targetJobType && targetIdStr) {
            try {
                const latest = await generationJobService.getLatestJobForTarget(
                    targetJobType,
                    targetIdStr
                );
                if (latest) {
                    setResolvedId(latest.id);
                    setJob(latest);
                    return;
                }
            } catch {
                // cai no fetch abaixo
            }
        }
        if (resolvedId) {
            try {
                const next = await generationJobService.getJob(resolvedId);
                if (next) setJob(next);
            } catch {
                // Silencioso.
            }
        }
    }, [resolvedId, targetJobType, targetIdStr]);

    return {
        job,
        isLoading,
        isActive: isGenerationJobActive(job?.status),
        refresh,
    };
}