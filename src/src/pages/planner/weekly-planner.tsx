import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WeekColumn } from '@/components/planner/week-column';
import { AddPlanItemModal, type AddItemData } from '@/components/planner/add-plan-item-modal';
import { PublishConfirmModal } from '@/components/planner/publish-confirm-modal';
import { PlannerSidebar } from '@/components/planner/planner-sidebar';
import { useWeeklyPlan } from '@/hooks/use-weekly-plan';
import { useWorkspaceStore } from '@/stores/workspace-store';
import {
    formatWeekRange,
    getDayOfWeekNumber,
    createDateAtTime,
    isToday,
    getSuggestedPillarForDay,
} from '@/lib/date-utils';
import type { ContentPillar } from '@/types/database';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
} from 'lucide-react';

export function WeeklyPlannerPage() {
    const { currentWorkspace } = useWorkspaceStore();
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
            const dayOfWeek = getDayOfWeekNumber(selectedDay);
            const [hours, minutes] = itemData.scheduledTime.split(':').map(Number);
            const scheduledFor = createDateAtTime(selectedDay, hours, minutes);

            const success = await addPlanItem({
                articleId: itemData.type === 'article' ? itemData.articleId : undefined,
                contentPieceId:
                    itemData.type === 'content_piece'
                        ? itemData.contentPieceId
                        : undefined,
                pillarId: itemData.pillarId || undefined,
                channelId: itemData.channelId || undefined,
                scheduledFor,
                dayOfWeek,
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
        publishedUrl?: string;
        publishedAt: Date;
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

    const getPillarSuggestionForDay = (dayOfWeek: number): ContentPillar | null => {
        const pillar = getSuggestedPillarForDay(dayOfWeek);
        return pillar as ContentPillar | null;
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

                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded bg-blue-100" />
                            Segunda, Quarta, Sexta
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>Dias activos por defeito</span>
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
                        const pillarSuggestion = getPillarSuggestionForDay(dayOfWeek);

                        return (
                            <WeekColumn
                                key={day.toISOString()}
                                date={day}
                                dayOfWeek={dayOfWeek}
                                items={dayItems}
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
                        pillarSuggestion={getPillarSuggestionForDay(
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
                    setSelectedDay(new Date());
                    setAddModalOpen(true);
                }}
            />
        </div>
    );
}
