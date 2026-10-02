import { planningConfigService } from '@/services/planning-config.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getDayName } from '@/lib/date-utils';
import type { ContentPillar } from '@/types/pillar';
import type { PlanningConfigWithPillar } from '@/types/planning-config';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Configuração dos dias de planeamento (uma linha por dia, 1=Seg ... 7=Dom).
 *
 * `isActive` é uma distinção visual, não uma permissão: a grelha mostra
 * sempre os 7 dias e todos aceitam items.
 *
 * Se a tabela vier vazia (workspace criado antes do backfill, ou ainda sem
 * config semeada), os 7 dias caem no default — todos activos, com o template
 * Segunda=P1 / Quarta=P2 / Sexta=P3 — e `ensureDefaultConfigs` preenche a BD
 * em segundo plano.
 */
export function usePlanningConfig() {
    const { currentWorkspace } = useWorkspaceStore();
    const [configs, setConfigs] = useState<PlanningConfigWithPillar[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSeeded, setIsSeeded] = useState(false);
    const hasFetchedRef = useRef(false);

    const workspaceId = currentWorkspace?.id;

    const fetchConfigs = useCallback(async () => {
        if (!workspaceId) return;

        setIsLoading(true);
        setError(null);

        try {
            let data = await planningConfigService.getPlanningConfigs(
                workspaceId
            );

            if (data.length === 0) {
                await planningConfigService.createDefaultPlanningConfigs(
                    workspaceId
                );
                data = await planningConfigService.getPlanningConfigs(
                    workspaceId
                );
                setIsSeeded(true);
            }

            setConfigs(data);
            hasFetchedRef.current = true;
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar configuração de planeamento'
            );
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        if (workspaceId && !hasFetchedRef.current) {
            fetchConfigs();
        }

        return () => {
            if (!workspaceId) {
                hasFetchedRef.current = false;
                setConfigs([]);
            }
        };
    }, [workspaceId, fetchConfigs]);

    const updateConfig = useCallback(
        async (
            dayOfWeek: number,
            updates: { isActive?: boolean; suggestedPillarId?: string | null }
        ): Promise<boolean> => {
            if (!workspaceId) return false;

            setIsSaving(dayOfWeek);
            setError(null);

            try {
                const updated = await planningConfigService.updatePlanningConfig(
                    workspaceId,
                    dayOfWeek,
                    updates
                );

                setConfigs((prev) =>
                    prev.map((c) => (c.dayOfWeek === dayOfWeek ? updated : c))
                );
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao atualizar configuração'
                );
                return false;
            } finally {
                setIsSaving(null);
            }
        },
        [workspaceId]
    );

    /** config de um dia, ou undefined se o workspace ainda não tem linhas. */
    const getConfigForDay = useCallback(
        (dayOfWeek: number): PlanningConfigWithPillar | undefined =>
            configs.find((c) => c.dayOfWeek === dayOfWeek),
        [configs]
    );

    /**
     * O enum que o PillarBadge consome. Vive na linha do pilar, não em
     * `suggestedPillarId` — daí o acesso via `suggestedPillar`.
     */
    const getSuggestedPillarForDay = useCallback(
        (dayOfWeek: number): ContentPillar | null =>
            getConfigForDay(dayOfWeek)?.suggestedPillar?.pillar ?? null,
        [getConfigForDay]
    );

    const isActiveDay = useCallback(
        (dayOfWeek: number): boolean =>
            getConfigForDay(dayOfWeek)?.isActive ?? false,
        [getConfigForDay]
    );

    /** Dias activos, 1..7. Cai nos 7 dias se a config ainda não carregou. */
    const activeDays = useCallback((): number[] => {
        const days = configs.filter((c) => c.isActive).map((c) => c.dayOfWeek);
        return days.length > 0 ? days.sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7];
    }, [configs]);

    /** "Segunda, Quarta e Sexta" — para legendas, geradas da config. */
    const activeDaysLabel = useCallback((): string => {
        const days = activeDays();
        const names = days.map((d) => getDayName(d));

        if (names.length === 0) return 'Nenhum dia activo';
        if (names.length === 1) return names[0];
        if (names.length === 7) return 'Todos os dias';

        return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
    }, [activeDays]);

    return {
        configs,
        isLoading,
        isSaving,
        error,
        isSeeded,
        getConfigForDay,
        getSuggestedPillarForDay,
        isActiveDay,
        activeDays,
        activeDaysLabel,
        updateConfig,
        refetch: fetchConfigs,
    };
}