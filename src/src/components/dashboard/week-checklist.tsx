import { Check, Clock, Calendar } from 'lucide-react';
import { PillarBadge } from '@/components/content/pillar-badge';
import { ChannelBadge } from '@/components/channels/channel-badge';
import type { PlanItemWithRelations } from '@/services/weekly-plan.service';
import type { ContentPillar } from '@/types/database';
import { formatFullDate } from '@/lib/date-utils';

interface WeekChecklistProps {
    items: PlanItemWithRelations[];
    onMarkPublished: (itemId: string) => void;
    onRemove: (itemId: string) => void;
    isLoading?: boolean;
}

const ACTIVE_DAYS = [
    { dayOfWeek: 1, shortName: 'Seg', fullName: 'Segunda-feira', pillar: 'P1_EDUCATION' as ContentPillar },
    { dayOfWeek: 3, shortName: 'Qua', fullName: 'Quarta-feira', pillar: 'P2_USE_CASES' as ContentPillar },
    { dayOfWeek: 5, shortName: 'Sex', fullName: 'Sexta-feira', pillar: 'P3_CONVERSION' as ContentPillar },
];

export function WeekChecklist({
    items,
    onMarkPublished,
    onRemove,
    isLoading = false,
}: WeekChecklistProps) {
    const getItemsForDay = (dayOfWeek: number) => {
        return items.filter((item) => item.dayOfWeek === dayOfWeek);
    };

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

    const getItemIcon = (item: PlanItemWithRelations): string => {
        if (item.contentPiece?.format) {
            const icons: Record<string, string> = {
                CAROUSEL: '📱',
                SHORT_VIDEO: '🎬',
                LINKEDIN_POST: '💼',
                IMAGE: '📸',
                THREAD: '🧵',
                CTA_POST: '🔗',
                VIDEO_SCRIPT: '📝',
            };
            return icons[item.contentPiece.format] || '📄';
        }
        return '📄';
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {ACTIVE_DAYS.map((day) => (
                    <div
                        key={day.dayOfWeek}
                        className="rounded-lg border border-gray-200 bg-white p-4"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />
                                <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
                            </div>
                            <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
                        </div>
                        <div className="space-y-2">
                            {[1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 rounded bg-gray-50 p-2"
                                >
                                    <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                                    <div className="h-4 flex-1 animate-pulse rounded bg-gray-200" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {ACTIVE_DAYS.map((day) => {
                const dayItems = getItemsForDay(day.dayOfWeek);
                const publishedCount = dayItems.filter(
                    (i) => i.status === 'PUBLISHED'
                ).length;
                const totalCount = dayItems.length;
                const isComplete = totalCount > 0 && publishedCount === totalCount;

                return (
                    <div
                        key={day.dayOfWeek}
                        className={`rounded-lg border p-4 ${
                            isComplete
                                ? 'border-green-200 bg-green-50/50'
                                : 'border-gray-200 bg-white'
                        }`}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`text-lg font-semibold ${
                                        isComplete ? 'text-green-700' : 'text-gray-900'
                                    }`}
                                >
                                    {day.fullName}
                                </span>
                                <PillarBadge pillar={day.pillar} size="sm" />
                            </div>
                            <div className="flex items-center gap-2">
                                {totalCount > 0 ? (
                                    <span
                                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                            isComplete
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {isComplete ? (
                                            <Check className="h-3 w-3" />
                                        ) : (
                                            <Clock className="h-3 w-3" />
                                        )}
                                        {publishedCount}/{totalCount}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                        <Calendar className="h-3 w-3" />
                                        Sem items
                                    </span>
                                )}
                            </div>
                        </div>

                        {dayItems.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                Nenhum item planeado para este dia.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {dayItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`flex items-center gap-3 rounded p-2 ${
                                            item.status === 'PUBLISHED'
                                                ? 'bg-green-50'
                                                : 'bg-gray-50'
                                        }`}
                                    >
                                        <button
                                            onClick={() =>
                                                item.status === 'PLANNED' &&
                                                onMarkPublished(item.id)
                                            }
                                            disabled={
                                                item.status === 'PUBLISHED'
                                            }
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                                                item.status === 'PUBLISHED'
                                                    ? 'border-green-500 bg-green-500 text-white'
                                                    : 'border-gray-300 hover:border-green-400'
                                            }`}
                                        >
                                            {item.status === 'PUBLISHED' && (
                                                <Check className="h-3 w-3" />
                                            )}
                                        </button>
                                        <span className="text-base">
                                            {getItemIcon(item)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className={`truncate text-sm ${
                                                    item.status === 'PUBLISHED'
                                                        ? 'text-green-700'
                                                        : 'text-gray-900'
                                                }`}
                                            >
                                                {getItemTitle(item)}
                                            </p>
                                            {item.channel && (
                                                <div className="mt-0.5">
                                                    <ChannelBadge
                                                        channel={
                                                            item.channel.channel
                                                        }
                                                        size="sm"
                                                        showLabel={false}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {item.status !== 'PUBLISHED' && (
                                            <button
                                                onClick={() => onRemove(item.id)}
                                                className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M6 18L18 6M6 6l12 12"
                                                    />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
