import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { weeklyPlanService } from '@/services/weekly-plan.service';
import type {
    PlanItemWithRelations,
    WeeklyPlanWithItems,
} from '@/services/weekly-plan.service';
import type { PlanItemStatus } from '@/types/database';
import {
    getWeekStart,
    getWeekEnd,
    addWeeksToDate,
    subtractWeeksFromDate,
    getDaysOfWeek,
} from '@/lib/date-utils';

export interface AddPlanItemParams {
    articleId?: string | null;
    contentPieceId?: string | null;
    productId?: string | null;
    pillarId?: string | null;
    channelId?: string | null;
    scheduledFor: Date;
    dayOfWeek: number;
    notes?: string | null;
}

export function useWeeklyPlan() {
    const { currentWorkspace } = useWorkspaceStore();
    const [currentWeek, setCurrentWeek] = useState<Date>(() =>
        getWeekStart(new Date())
    );
    const [weekPlan, setWeekPlan] = useState<WeeklyPlanWithItems | null>(null);
    const [items, setItems] = useState<PlanItemWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadWeekPlan = useCallback(async () => {
        if (!currentWorkspace?.id) return;

        setIsLoading(true);
        setError(null);

        try {
            const plan = await weeklyPlanService.getOrCreateWeekPlanWithItems(
                currentWorkspace.id,
                currentWeek,
                getWeekEnd(currentWeek)
            );
            setWeekPlan(plan);
            setItems(plan.items);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar plano semanal'
            );
        } finally {
            setIsLoading(false);
        }
    }, [currentWorkspace?.id, currentWeek]);

    useEffect(() => {
        loadWeekPlan();
    }, [loadWeekPlan]);

    const goToNextWeek = useCallback(() => {
        setCurrentWeek((prev) => addWeeksToDate(prev, 1));
    }, []);

    const goToPreviousWeek = useCallback(() => {
        setCurrentWeek((prev) => subtractWeeksFromDate(prev, 1));
    }, []);

    const goToCurrentWeek = useCallback(() => {
        setCurrentWeek(getWeekStart(new Date()));
    }, []);

    const goToWeek = useCallback((date: Date) => {
        setCurrentWeek(getWeekStart(date));
    }, []);

    const getItemsForDay = useCallback(
        (dayOfWeek: number): PlanItemWithRelations[] => {
            return items.filter((item) => item.dayOfWeek === dayOfWeek);
        },
        [items]
    );

    const addPlanItem = useCallback(
        async (params: AddPlanItemParams): Promise<boolean> => {
            if (!weekPlan || !currentWorkspace?.id) {
                setError('Plano semanal não disponível');
                return false;
            }

            try {
                await weeklyPlanService.createPlanItem({
                    weeklyPlanId: weekPlan.id,
                    workspaceId: currentWorkspace.id,
                    articleId: params.articleId,
                    contentPieceId: params.contentPieceId,
                    productId: params.productId,
                    pillarId: params.pillarId,
                    channelId: params.channelId,
                    scheduledFor: params.scheduledFor,
                    dayOfWeek: params.dayOfWeek,
                    notes: params.notes,
                });

                await loadWeekPlan();
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao adicionar item'
                );
                return false;
            }
        },
        [weekPlan, currentWorkspace?.id, loadWeekPlan]
    );

    const removePlanItem = useCallback(
        async (itemId: string): Promise<boolean> => {
            try {
                await weeklyPlanService.removePlanItemAndRevertPiece(itemId);
                setItems((prev) => prev.filter((item) => item.id !== itemId));
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao remover item'
                );
                return false;
            }
        },
        []
    );

    const markAsPublished = useCallback(
        async (
            itemId: string,
            data: { publishedUrl?: string; publishedAt: Date }
        ): Promise<boolean> => {
            try {
                await weeklyPlanService.markAsPublished(itemId, data);
                setItems((prev) =>
                    prev.map((item) =>
                        item.id === itemId
                            ? {
                                  ...item,
                                  status: 'PUBLISHED' as PlanItemStatus,
                                  publishedAt: data.publishedAt.toISOString(),
                                  publishedUrl: data.publishedUrl || null,
                              }
                            : item
                    )
                );
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao marcar como publicado'
                );
                return false;
            }
        },
        []
    );

    const updatePlanItemStatus = useCallback(
        async (itemId: string, status: PlanItemStatus): Promise<boolean> => {
            try {
                await weeklyPlanService.updatePlanItemStatus(itemId, status);
                setItems((prev) =>
                    prev.map((item) =>
                        item.id === itemId
                            ? {
                                  ...item,
                                  status,
                                  publishedAt:
                                      status === 'PUBLISHED'
                                          ? new Date().toISOString()
                                          : item.publishedAt,
                              }
                            : item
                    )
                );
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao atualizar status'
                );
                return false;
            }
        },
        []
    );

    const updatePlanItem = useCallback(
        async (
            itemId: string,
            updates: Partial<AddPlanItemParams>
        ): Promise<boolean> => {
            try {
                await weeklyPlanService.updatePlanItem(itemId, {
                    ...updates,
                    scheduledFor: updates.scheduledFor?.toISOString(),
                });
                await loadWeekPlan();
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao atualizar item'
                );
                return false;
            }
        },
        [loadWeekPlan]
    );

    const weekDays = getDaysOfWeek(currentWeek);

    const stats = {
        totalItems: items.length,
        plannedItems: items.filter((i) => i.status === 'PLANNED').length,
        publishedItems: items.filter((i) => i.status === 'PUBLISHED').length,
        skippedItems: items.filter((i) => i.status === 'SKIPPED').length,
    };

    return {
        currentWeek,
        weekPlan,
        items,
        weekDays,
        isLoading,
        error,
        stats,
        goToNextWeek,
        goToPreviousWeek,
        goToCurrentWeek,
        goToWeek,
        getItemsForDay,
        addPlanItem,
        removePlanItem,
        updatePlanItemStatus,
        updatePlanItem,
        markAsPublished,
        refetch: loadWeekPlan,
    };
}
