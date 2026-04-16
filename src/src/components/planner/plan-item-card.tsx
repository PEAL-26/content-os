import { useState } from 'react';
import { ChannelBadge } from '@/components/channels/channel-badge';
import { PillarBadge } from '@/components/content/pillar-badge';
import type { PlanItemWithRelations } from '@/services/weekly-plan.service';
import type { ContentPillar, SocialChannel } from '@/types/database';
import { formatTime } from '@/lib/date-utils';
import { Check, Eye, Trash2, ExternalLink, X } from 'lucide-react';

interface PlanItemCardProps {
    item: PlanItemWithRelations;
    onRemove: () => void;
    onMarkPublished: () => void;
    onViewContent?: () => void;
    compact?: boolean;
}

export function PlanItemCard({
    item,
    onRemove,
    onMarkPublished,
    onViewContent,
    compact = false,
}: PlanItemCardProps) {
    const [showActions, setShowActions] = useState(false);
    const isPublished = item.status === 'PUBLISHED';
    const isSkipped = item.status === 'SKIPPED';

    const getContentTitle = () => {
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

    const getFormatIcon = () => {
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

    const getPillarColor = (): string => {
        if (!item.pillar?.pillar) return '';
        const colors: Record<string, string> = {
            P1_EDUCATION: 'bg-blue-50 border-blue-200',
            P2_USE_CASES: 'bg-green-50 border-green-200',
            P3_CONVERSION: 'bg-orange-50 border-orange-200',
            P4_AUTHORITY: 'bg-purple-50 border-purple-200',
        };
        return colors[item.pillar.pillar] || '';
    };

    if (compact) {
        return (
            <div
                className={`group flex items-center gap-2 rounded-md border bg-white p-2 transition-all ${
                    isPublished
                        ? 'border-green-200 opacity-60'
                        : isSkipped
                            ? 'border-red-200 opacity-50'
                            : 'border-gray-200 hover:border-gray-300'
                }`}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                <span className="text-base">{getFormatIcon()}</span>
                <div className="min-w-0 flex-1">
                    <p
                        className={`truncate text-xs font-medium ${
                            isPublished || isSkipped
                                ? 'text-gray-500'
                                : 'text-gray-900'
                        }`}
                    >
                        {getContentTitle()}
                    </p>
                    <div className="flex items-center gap-1">
                        {item.channel && (
                            <span className="text-xs text-gray-500">
                                {item.channel.channel}
                            </span>
                        )}
                        {item.scheduledFor && (
                            <span className="text-xs text-gray-400">
                                {formatTime(new Date(item.scheduledFor))}
                            </span>
                        )}
                    </div>
                </div>

                {showActions && (
                    <div className="flex items-center gap-1">
                        {isPublished ? (
                            <Check className="h-4 w-4 text-green-500" />
                        ) : (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMarkPublished();
                                    }}
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200"
                                    title="Marcar como publicado"
                                >
                                    <Check className="h-3 w-3" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemove();
                                    }}
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                                    title="Remover"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className={`group relative rounded-lg border p-3 transition-all ${
                isPublished
                    ? 'border-green-200 bg-green-50/50 opacity-75'
                    : isSkipped
                        ? 'border-red-200 bg-red-50/50 opacity-50'
                        : getPillarColor() || 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            {isPublished && (
                <div className="absolute -left-1 -top-1">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check className="h-3 w-3" />
                    </div>
                </div>
            )}

            <div className="flex items-start gap-2">
                <span className="text-xl">{getFormatIcon()}</span>
                <div className="min-w-0 flex-1">
                    <p
                        className={`truncate text-sm font-medium ${
                            isPublished || isSkipped
                                ? 'text-gray-500'
                                : 'text-gray-900'
                        }`}
                    >
                        {getContentTitle()}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {item.channel && (
                            <ChannelBadge
                                channel={item.channel.channel}
                                size="sm"
                                showLabel={true}
                            />
                        )}
                        {item.pillar?.pillar && (
                            <PillarBadge
                                pillar={item.pillar.pillar as ContentPillar}
                                size="sm"
                            />
                        )}
                    </div>

                    {item.scheduledFor && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                            <span className="font-medium">
                                {formatTime(new Date(item.scheduledFor))}
                            </span>
                            {item.publishedAt && (
                                <span className="text-green-600">
                                    (publicado{' '}
                                    {formatTime(new Date(item.publishedAt))})
                                </span>
                            )}
                        </p>
                    )}

                    {item.notes && (
                        <p className="mt-1.5 line-clamp-1 text-xs italic text-gray-500">
                            {item.notes}
                        </p>
                    )}
                </div>
            </div>

            {showActions && !isSkipped && (
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
                    <div className="flex gap-1">
                        {item.contentPieceId && onViewContent && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewContent();
                                }}
                                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                                title="Ver conteúdo"
                            >
                                <Eye className="h-3 w-3" />
                                Ver
                            </button>
                        )}
                        {item.publishedUrl && (
                            <a
                                href={item.publishedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                                title="Abrir link"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Link
                            </a>
                        )}
                    </div>

                    <div className="flex gap-1">
                        {!isPublished && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMarkPublished();
                                    }}
                                    className="flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                                    title="Marcar como publicado"
                                >
                                    <Check className="h-3 w-3" />
                                    Publicar
                                </button>
                            </>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            title="Remover do planeamento"
                        >
                            <Trash2 className="h-3 w-3" />
                            Remover
                        </button>
                    </div>
                </div>
            )}

            {isPublished && (
                <div className="mt-2 flex items-center justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                        title="Remover do planeamento"
                    >
                        <Trash2 className="h-3 w-3" />
                        Arquivar
                    </button>
                </div>
            )}
        </div>
    );
}
