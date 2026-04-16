import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChannelBadge } from '@/components/channels/channel-badge';
import { PillarBadge } from '@/components/content/pillar-badge';
import { contentPieceService } from '@/services/content-piece.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { ContentPieceWithRelations, ContentPillar } from '@/types/database';
import { formatWeekRange } from '@/lib/date-utils';
import {
    Calendar,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    ChevronRight,
    Image,
} from 'lucide-react';

interface PlannerSidebarProps {
    currentWeek: Date;
    stats: {
        totalItems: number;
        plannedItems: number;
        publishedItems: number;
        skippedItems: number;
    };
    targetPostsPerWeek: number;
    onAddPiece: () => void;
}

export function PlannerSidebar({
    currentWeek,
    stats,
    targetPostsPerWeek,
    onAddPiece,
}: PlannerSidebarProps) {
    const { currentWorkspace } = useWorkspaceStore();
    const [unassignedPieces, setUnassignedPieces] = useState<ContentPieceWithRelations[]>([]);
    const [isLoadingPieces, setIsLoadingPieces] = useState(false);
    const [showUnassigned, setShowUnassigned] = useState(false);

    useEffect(() => {
        if (currentWorkspace?.id) {
            loadUnassignedPieces();
        }
    }, [currentWorkspace?.id]);

    const loadUnassignedPieces = async () => {
        if (!currentWorkspace?.id) return;

        setIsLoadingPieces(true);
        try {
            const pieces = await contentPieceService.getWorkspaceContentPieces(
                currentWorkspace.id,
                { status: 'APPROVED' }
            );
            setUnassignedPieces(pieces);
        } catch (error) {
            console.error('Error loading unassigned pieces:', error);
        } finally {
            setIsLoadingPieces(false);
        }
    };

    const progress = Math.round(
        (stats.publishedItems / targetPostsPerWeek) * 100
    );

    const isOverTarget = stats.totalItems > targetPostsPerWeek;
    const isOnTrack = stats.publishedItems >= stats.plannedItems * 0.5;

    const formatIcons: Record<string, string> = {
        CAROUSEL: '📱',
        SHORT_VIDEO: '🎬',
        LINKEDIN_POST: '💼',
        IMAGE: '📸',
        THREAD: '🧵',
        CTA_POST: '🔗',
        VIDEO_SCRIPT: '📝',
    };

    return (
        <aside className="w-80 space-y-4 rounded-lg bg-white p-4 shadow-sm">
            <div className="border-b border-gray-200 pb-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    Semana
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                    {formatWeekRange(currentWeek)}
                </p>
            </div>

            <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">
                    Progresso semanal
                </h4>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                            {stats.publishedItems} de {targetPostsPerWeek} posts
                        </span>
                        <span
                            className={`font-medium ${
                                progress >= 100
                                    ? 'text-green-600'
                                    : progress >= 50
                                        ? 'text-yellow-600'
                                        : 'text-gray-600'
                            }`}
                        >
                            {progress}%
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                            className={`h-full rounded-full transition-all ${
                                progress >= 100
                                    ? 'bg-green-500'
                                    : progress >= 50
                                        ? 'bg-yellow-500'
                                        : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                </div>

                {isOverTarget && (
                    <div className="flex items-start gap-2 rounded-lg bg-orange-50 p-2 text-xs text-orange-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            Tens mais posts planeados do que o target de{' '}
                            {targetPostsPerWeek}/semana.
                        </span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-3 gap-2">
                <StatCard
                    icon={<Clock className="h-4 w-4" />}
                    value={stats.plannedItems}
                    label="Planeados"
                    color="gray"
                />
                <StatCard
                    icon={<CheckCircle className="h-4 w-4" />}
                    value={stats.publishedItems}
                    label="Publicados"
                    color="green"
                />
                <StatCard
                    icon={<XCircle className="h-4 w-4" />}
                    value={stats.skippedItems}
                    label="Ignorados"
                    color="red"
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Image className="h-4 w-4 text-gray-400" />
                        Peças por agendar
                    </h4>
                    {unassignedPieces.length > 0 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {unassignedPieces.length}
                        </span>
                    )}
                </div>

                {isLoadingPieces ? (
                    <div className="flex items-center justify-center py-4">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    </div>
                ) : unassignedPieces.length === 0 ? (
                    <div className="rounded-lg bg-gray-50 p-3 text-center">
                        <p className="text-xs text-gray-500">
                            Todas as peças estão agendadas
                        </p>
                    </div>
                ) : (
                    <>
                        <button
                            onClick={() => setShowUnassigned(!showUnassigned)}
                            className="flex w-full items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                        >
                            <span>
                                {unassignedPieces.length} peça
                                {unassignedPieces.length > 1 ? 's' : ''} aprovada
                                {unassignedPieces.length > 1 ? 's' : ''}
                            </span>
                            <ChevronRight
                                className={`h-4 w-4 transition-transform ${
                                    showUnassigned ? 'rotate-90' : ''
                                }`}
                            />
                        </button>

                        {showUnassigned && (
                            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-2">
                                {unassignedPieces.slice(0, 5).map((piece) => (
                                    <div
                                        key={piece.id}
                                        className="flex items-center gap-2 rounded p-2 hover:bg-gray-50"
                                    >
                                        <span className="text-base">
                                            {formatIcons[piece.format] || '📄'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-medium text-gray-900">
                                                {piece.title ||
                                                    `Post ${piece.format}`}
                                            </p>
                                            <div className="flex items-center gap-1">
                                                {piece.channel && (
                                                    <span className="text-xs text-gray-500">
                                                        {piece.channel.channel}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {unassignedPieces.length > 5 && (
                                    <p className="text-center text-xs text-gray-500">
                                        +{unassignedPieces.length - 5} mais
                                    </p>
                                )}
                                <Button
                                    size="sm"
                                    onClick={onAddPiece}
                                    className="w-full"
                                >
                                    Agendar peça
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {unassignedPieces.length > 0 && !showUnassigned && (
                <Button onClick={onAddPiece} className="w-full">
                    <Image className="mr-2 h-4 w-4" />
                    Agendar peça
                </Button>
            )}
        </aside>
    );
}

interface StatCardProps {
    icon: React.ReactNode;
    value: number;
    label: string;
    color: 'gray' | 'green' | 'red';
}

function StatCard({ icon, value, label, color }: StatCardProps) {
    const colors = {
        gray: 'bg-gray-100 text-gray-600',
        green: 'bg-green-100 text-green-600',
        red: 'bg-red-100 text-red-600',
    };

    return (
        <div className="flex flex-col items-center rounded-lg bg-gray-50 p-2">
            <div className={`rounded-full p-1 ${colors[color]}`}>{icon}</div>
            <span className="mt-1 text-lg font-semibold text-gray-900">
                {value}
            </span>
            <span className="text-xs text-gray-500">{label}</span>
        </div>
    );
}
