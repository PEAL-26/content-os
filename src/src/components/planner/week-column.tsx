import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PillarBadge } from '@/components/content/pillar-badge';
import { PlanItemCard } from '@/components/planner/plan-item-card';
import type { PlanItemWithRelations } from '@/services/weekly-plan.service';
import type { ContentPillar } from '@/types/database';
import {
    formatDayOfWeek,
    formatDayNumber,
    getSuggestedPillarForDay,
    isActiveDay,
} from '@/lib/date-utils';
import { Plus } from 'lucide-react';

interface WeekColumnProps {
    date: Date;
    dayOfWeek: number;
    items: PlanItemWithRelations[];
    suggestedPillar?: ContentPillar | null;
    onAddItem: () => void;
    onRemoveItem: (itemId: string) => void;
    onMarkPublished: (
        itemId: string,
        title: string,
        scheduledFor: string
    ) => void;
    onViewContent?: (itemId: string) => void;
    isLoading?: boolean;
}

export function WeekColumn({
    date,
    dayOfWeek,
    items,
    suggestedPillar,
    onAddItem,
    onRemoveItem,
    onMarkPublished,
    onViewContent,
    isLoading = false,
}: WeekColumnProps) {
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const activeDay = isActiveDay(dayOfWeek);
    const pillarSuggestion = suggestedPillar || getSuggestedPillarForDay(dayOfWeek);

    const dayName = formatDayOfWeek(date);
    const dayNumber = formatDayNumber(date);

    const getItemTitle = (item: PlanItemWithRelations): string => {
        if (item.contentPiece) {
            return item.contentPiece.title || `Post ${item.contentPiece.format}`;
        }
        if (item.article) {
            return item.article.title;
        }
        if (item.product) {
            return item.product.name;
        }
        return 'Item';
    };

    return (
        <div
            className={`flex flex-col rounded-lg border ${
                activeDay
                    ? 'border-blue-200 bg-white'
                    : 'border-gray-200 bg-gray-50/50'
            } min-h-[400px]`}
        >
            <div
                className={`flex flex-col items-center border-b px-2 py-3 ${
                    activeDay ? 'border-blue-200' : 'border-gray-200'
                }`}
            >
                <span
                    className={`text-xs font-medium uppercase ${
                        activeDay ? 'text-blue-600' : 'text-gray-400'
                    }`}
                >
                    {dayName}
                </span>
                <span
                    className={`text-2xl font-bold ${
                        activeDay ? 'text-gray-900' : 'text-gray-400'
                    }`}
                >
                    {dayNumber}
                </span>
                {pillarSuggestion && activeDay && (
                    <div className="mt-2">
                        <PillarBadge
                            pillar={pillarSuggestion as ContentPillar}
                            size="sm"
                        />
                    </div>
                )}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {items.length === 0 ? (
                    <div className="flex h-24 items-center justify-center">
                        <p className="text-center text-xs text-gray-400">
                            Sem items<br />agendados
                        </p>
                    </div>
                ) : (
                    items.map((item) => (
                        <PlanItemCard
                            key={item.id}
                            item={item}
                            onRemove={() => onRemoveItem(item.id)}
                            onMarkPublished={() =>
                                onMarkPublished(
                                    item.id,
                                    getItemTitle(item),
                                    item.scheduledFor
                                )
                            }
                            onViewContent={
                                onViewContent
                                    ? () => onViewContent(item.id)
                                    : undefined
                            }
                        />
                    ))
                )}
            </div>

            <div className="border-t border-gray-200 p-2">
                {showQuickAdd ? (
                    <div className="space-y-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAddItem}
                            className="w-full"
                            disabled={isLoading}
                        >
                            <Plus className="h-4 w-4" />
                            Selecionar conteúdo
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowQuickAdd(false)}
                            className="w-full text-xs"
                        >
                            Cancelar
                        </Button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowQuickAdd(true)}
                        className={`flex w-full items-center justify-center gap-1 rounded-md py-2 text-sm transition-colors ${
                            activeDay
                                ? 'text-blue-600 hover:bg-blue-50'
                                : 'text-gray-400 hover:bg-gray-100'
                        }`}
                    >
                        <Plus className="h-4 w-4" />
                        <span className="text-xs">Adicionar</span>
                    </button>
                )}
            </div>
        </div>
    );
}
