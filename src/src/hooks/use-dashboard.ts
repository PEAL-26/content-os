import { useCallback, useEffect, useState } from 'react';
import { articleService } from '@/services/article.service';
import { contentPieceService } from '@/services/content-piece.service';
import { pillarService } from '@/services/pillar.service';
import { weeklyPlanService } from '@/services/weekly-plan.service';
import { DEFAULT_PUBLICATION_PLATFORM } from '@/services/publication-platforms';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { usePlanningConfig } from '@/hooks/use-planning-config';
import type {
    ArticleWithRelations,
    ContentPieceWithRelations,
} from '@/types/database';
import type { PillarConfig } from '@/types/pillar';
import type { PlanItemWithRelations } from '@/services/weekly-plan.service';
import type { ContentPillar } from '@/types/database';
import {
    getWeekStart,
    getWeekEnd,
    getDayName,
    getShortDayName,
} from '@/lib/date-utils';

export interface PillarDistribution {
    pillar: ContentPillar;
    count: number;
    percentage: number;
    color: string;
}

export interface DayChecklist {
    dayOfWeek: number;
    dayName: string;
    shortName: string;
    pillar: ContentPillar | null;
    items: PlanItemWithRelations[];
    publishedCount: number;
    totalCount: number;
}

/** Dia do checklist pronto a renderizar, com o nome já resolvido. */
export type ChecklistDay = DayChecklist;

export function useDashboard() {
    const { currentWorkspace } = useWorkspaceStore();
    const {
        activeDays,
        getSuggestedPillarForDay,
    } = usePlanningConfig();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [draftArticles, setDraftArticles] = useState<ArticleWithRelations[]>([]);
    const [allArticles, setAllArticles] = useState<ArticleWithRelations[]>([]);
    const [pendingPieces, setPendingPieces] = useState<ContentPieceWithRelations[]>([]);
    const [pillars, setPillars] = useState<PillarConfig[]>([]);
    const [weekItems, setWeekItems] = useState<PlanItemWithRelations[]>([]);
    const [approvedPieces, setApprovedPieces] = useState<ContentPieceWithRelations[]>([]);

    const targetPostsPerWeek = currentWorkspace?.postsPerWeek || 3;

    const fetchData = useCallback(async () => {
        if (!currentWorkspace?.id) return;

        setIsLoading(true);
        setError(null);

        try {
            const now = new Date();
            const weekStart = getWeekStart(now);
            const weekEnd = getWeekEnd(now);

            const [
                draftData,
                allArticlesData,
                pendingData,
                pillarsData,
                weekPlanData,
                approvedData,
            ] = await Promise.all([
                articleService.getArticles(currentWorkspace.id, {
                    status: 'DRAFT',
                    limit: 3,
                }),
                articleService.getArticles(currentWorkspace.id, {
                    status: 'ALL',
                }),
                contentPieceService.getWorkspaceContentPieces(
                    currentWorkspace.id,
                    { status: 'DRAFT' }
                ),
                pillarService.getPillars(currentWorkspace.id),
                weeklyPlanService.getOrCreateWeekPlanWithItems(
                    currentWorkspace.id,
                    weekStart,
                    weekEnd
                ),
                contentPieceService.getWorkspaceContentPieces(
                    currentWorkspace.id,
                    { status: 'APPROVED' }
                ),
            ]);

            setDraftArticles(draftData);
            setAllArticles(allArticlesData);
            setPendingPieces(pendingData.slice(0, 5));
            setPillars(pillarsData.filter((p) => p.isActive));
            setWeekItems(weekPlanData.items);
            setApprovedPieces(approvedData);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar dados do dashboard'
            );
        } finally {
            setIsLoading(false);
        }
    }, [currentWorkspace?.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const weekStats = {
        plannedItems: weekItems.filter((i) => i.status === 'PLANNED').length,
        publishedItems: weekItems.filter((i) => i.status === 'PUBLISHED').length,
        totalItems: weekItems.length,
        compliancePercent:
            targetPostsPerWeek > 0
                ? Math.round(
                      (weekItems.filter((i) => i.status === 'PUBLISHED').length /
                          targetPostsPerWeek) *
                          100
                  )
                : 0,
    };

    const pillarDistribution: PillarDistribution[] = pillars
        .filter((p) => p.isActive)
        .map((p) => {
            const count = allArticles.filter(
                (a) => a.pillarId === p.id
            ).length;
            const total = allArticles.length;
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

            const colors: Record<string, string> = {
                P1_EDUCATION: 'bg-blue-500',
                P2_USE_CASES: 'bg-green-500',
                P3_CONVERSION: 'bg-orange-500',
                P4_AUTHORITY: 'bg-purple-500',
            };

            return {
                pillar: p.pillar,
                count,
                percentage,
                color: colors[p.pillar] || 'bg-gray-500',
            };
        });

    const dayChecklists: DayChecklist[] = activeDays().map((dayOfWeek) => {
        const dayItems = weekItems.filter((i) => i.dayOfWeek === dayOfWeek);

        return {
            dayOfWeek,
            dayName: getDayName(dayOfWeek),
            shortName: getShortDayName(dayOfWeek),
            pillar: getSuggestedPillarForDay(dayOfWeek),
            items: dayItems,
            publishedCount: dayItems.filter((i) => i.status === 'PUBLISHED').length,
            totalCount: dayItems.length,
        };
    });

    const markItemPublished = useCallback(
        async (itemId: string) => {
            try {
                await weeklyPlanService.markAsPublished(itemId, {
                    // Marca o canal principal do workspace como destino, e
                    // não um `'outros'` que deixou de existir no enum.
                    platform: DEFAULT_PUBLICATION_PLATFORM,
                    publishedAt: new Date(),
                });
                setWeekItems((prev) =>
                    prev.map((item) =>
                        item.id === itemId
                            ? {
                                  ...item,
                                  status: 'PUBLISHED' as const,
                                  publishedAt: new Date().toISOString(),
                              }
                            : item
                    )
                );
            } catch (err) {
                console.error('Error marking item as published:', err);
            }
        },
        []
    );

    const removeItem = useCallback(async (itemId: string) => {
        try {
            await weeklyPlanService.removePlanItemAndRevertPiece(itemId);
            setWeekItems((prev) => prev.filter((item) => item.id !== itemId));
        } catch (err) {
            console.error('Error removing item:', err);
        }
    }, []);

    const approvePiece = useCallback(async (pieceId: string) => {
        try {
            await contentPieceService.updateStatus(pieceId, 'APPROVED');
            setPendingPieces((prev) => prev.filter((p) => p.id !== pieceId));
        } catch (err) {
            console.error('Error approving piece:', err);
        }
    }, []);

    return {
        isLoading,
        error,
        draftArticles,
        pendingPieces,
        pillars,
        weekStats,
        pillarDistribution,
        dayChecklists,
        approvedPieces,
        targetPostsPerWeek,
        markItemPublished,
        removeItem,
        approvePiece,
        refetch: fetchData,
    };
}
