import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WeekColumn } from '@/components/planner/week-column';
import { AddPlanItemModal, type AddItemData } from '@/components/planner/add-plan-item-modal';
import { PublishConfirmModal } from '@/components/planner/publish-confirm-modal';
import { PlannerSidebar } from '@/components/planner/planner-sidebar';
import { useWeeklyPlan } from '@/hooks/use-weekly-plan';
import { usePlanningConfig } from '@/hooks/use-planning-config';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { workspacePath } from '@/lib/workspace-paths';
import {
    formatWeekRange,
    getDayOfWeekNumber,
    createDateAtTime,
    isToday,
} from '@/lib/date-utils';
import type { ContentPillar } from '@/types/database';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Settings2,
} from 'lucide-react';

export function WeeklyPlannerPage() {
    const { currentWorkspace } = useWorkspaceStore();
    const navigate = useNavigate();
    const {
        currentWeek,
        weekDays,
        isLoading,
        error,
        stats,
        goToNextWeek,
        goToPreviousWeek,
        goToCurrentWeek,
        getItemsForDay,
        addPlanItem,
        removePlanItem,
        markAsPublished,
    } = useWeeklyPlan();
    const {
        activeDaysLabel,
        isActiveDay: isConfiguredActiveDay,
        getSuggestedPillarForDay,
    } = usePlanningConfig();

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [publishModalOpen, setPublishModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [selectedItemForPublish, setSelectedItemForPublish] = useState<{
        id: string;
        title: string;
        scheduledFor: string;
    } | null>(null);
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const targetPostsPerWeek = currentWorkspace?.postsPerWeek || 3;

    const handleOpenAddModal = (date: Date) => {
        setSelectedDay(date);
        setAddModalOpen(true);
    };

    const handleAddItem = async (itemData: AddItemData) => {
        if (!selectedDay || !currentWorkspace) return;

        setIsAddingItem(true);
        try {
            const [hours, minutes] = itemData.scheduledTime.split(':').map(Number);
            const scheduledFor = createDateAtTime(selectedDay, hours, minutes);

            // dayOfWeek não é enviado: o serviço deriva-o de scheduledFor.
            const success = await addPlanItem({
                articleId: itemData.type === 'article' ? itemData.articleId : undefined,
                contentPieceId:
                    itemData.type === 'content_piece'
                        ? itemData.contentPieceId
                        : undefined,
                pillarId: itemData.pillarId || undefined,
                channelId: itemData.channelId || undefined,
                scheduledFor,
                notes: itemData.notes || null,
            });

            if (success) {
                setAddModalOpen(false);
                setSelectedDay(null);
            }
        } finally {
            setIsAddingItem(false);
        }
    };

    const handleOpenPublishModal = (
        itemId: string,
        title: string,
        scheduledFor: string
    ) => {
        setSelectedItemForPublish({ id: itemId, title, scheduledFor });
        setPublishModalOpen(true);
    };

    const handlePublish = async (data: {
        platform: string;
        publishedUrl?: string;
        publishedAt: Date;
        assetFile?: File | null;
    }) => {
        if (!selectedItemForPublish) return;

        setIsPublishing(true);
        try {
            const success = await markAsPublished(selectedItemForPublish.id, data);
            if (success) {
                setPublishModalOpen(false);
                setSelectedItemForPublish(null);
            }
        } finally {
            setIsPublishing(false);
        }
    };

    const handleRemoveItem = async (itemId: string) => {
        await removePlanItem(itemId);
    };

    const isCurrentWeek = weekDays.some((day) => isToday(day));

    /**
     * Dia a abrir quando o utilizador entra pela barra lateral em vez de
     * clicar numa coluna.
     *
     * Antes era sempre `new Date()` — o item era agendado para hoje
     * independentemente da semana visível e, se hoje não pertencesse a essa
     * semana, nunca aparecia na grelha. Agora: hoje se estiver na semana,
     * senão o primeiro dia activo dela.
     */
    const getDefaultDayForSidebar = (): Date => {
        const today = new Date();
        const todayInWeek = weekDays.some(
            (day) =>
                day.getFullYear() === today.getFullYear() &&
                day.getMonth() === today.getMonth() &&
                day.getDate() === today.getDate()
        );

        if (todayInWeek) return today;

        const firstActiveDay = weekDays.find((day) =>
            isConfiguredActiveDay(getDayOfWeekNumber(day))
        );

        return firstActiveDay ?? weekDays[0] ?? today;
    };

    return (
        <div className="flex gap-6">
            <div className="flex-1 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Planeador Semanal
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            {formatWeekRange(currentWeek)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToNextWeek}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        {!isCurrentWeek && (
                            <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
                                <Calendar className="h-4 w-4" />
                                Esta semana
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded bg-blue-100" />
                            {activeDaysLabel()}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>Dias activos</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() =>
                                navigate(
                                    workspacePath(
                                        currentWorkspace?.id ?? '',
                                        'settings/planning'
                                    )
                                )
                            }
                        >
                            <Settings2 className="h-3 w-3" />
                            Configurar dias
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-7 gap-4">
                    {weekDays.map((day) => {
                        const dayOfWeek = getDayOfWeekNumber(day);
                        const dayItems = getItemsForDay(dayOfWeek);
                        const pillarSuggestion =
                            getSuggestedPillarForDay(dayOfWeek) as ContentPillar | null;

                        return (
                            <WeekColumn
                                key={day.toISOString()}
                                date={day}
                                dayOfWeek={dayOfWeek}
                                items={dayItems}
                                isActiveDay={isConfiguredActiveDay(dayOfWeek)}
                                suggestedPillar={pillarSuggestion}
                                onAddItem={() => handleOpenAddModal(day)}
                                onRemoveItem={handleRemoveItem}
                                onMarkPublished={(itemId, title, scheduledFor) =>
                                    handleOpenPublishModal(itemId, title, scheduledFor)
                                }
                                isLoading={isLoading}
                            />
                        );
                    })}
                </div>

                {currentWorkspace && selectedDay && (
                    <AddPlanItemModal
                        isOpen={addModalOpen}
                        onClose={() => {
                            setAddModalOpen(false);
                            setSelectedDay(null);
                        }}
                        onAdd={handleAddItem}
                        workspaceId={currentWorkspace.id}
                        selectedDate={selectedDay}
                        dayOfWeek={getDayOfWeekNumber(selectedDay)}
                        pillarSuggestion={getSuggestedPillarForDay(
                            getDayOfWeekNumber(selectedDay)
                        )}
                        isLoading={isAddingItem}
                    />
                )}

                {selectedItemForPublish && (
                    <PublishConfirmModal
                        isOpen={publishModalOpen}
                        onClose={() => {
                            setPublishModalOpen(false);
                            setSelectedItemForPublish(null);
                        }}
                        onConfirm={handlePublish}
                        itemTitle={selectedItemForPublish.title}
                        scheduledTime={new Date(selectedItemForPublish.scheduledFor)}
                        isLoading={isPublishing}
                    />
                )}
            </div>

            <PlannerSidebar
                currentWeek={currentWeek}
                stats={stats}
                targetPostsPerWeek={targetPostsPerWeek}
                onAddPiece={() => {
                    setSelectedDay(getDefaultDayForSidebar());
                    setAddModalOpen(true);
                }}
            />
        </div>
    );
}
