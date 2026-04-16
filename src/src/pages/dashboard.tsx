import { useAuthContext } from '@/context/auth-context';
import { MetricCard, SkeletonCard } from '@/components/dashboard/metric-card';
import { WeekChecklist } from '@/components/dashboard/week-checklist';
import { PillarBadge } from '@/components/content/pillar-badge';
import { ChannelBadge } from '@/components/channels/channel-badge';
import { useDashboard } from '@/hooks/use-dashboard';
import {
    Calendar,
    CheckCircle,
    Clock,
    FileText,
    Image,
    TrendingUp,
    AlertCircle,
    ChevronRight,
    Edit,
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export function DashboardPage() {
    const { user } = useAuthContext();
    const {
        isLoading,
        error,
        draftArticles,
        pendingPieces,
        pillarDistribution,
        dayChecklists,
        weekStats,
        targetPostsPerWeek,
        markItemPublished,
        removeItem,
        approvePiece,
    } = useDashboard();

    const greeting = 'Olá';
    const userName = user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        'Utilizador';
    const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: pt });

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
        <div className="space-y-8">
            {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                    <AlertCircle className="mr-2 inline h-4 w-4" />
                    {error}
                </div>
            )}

            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {greeting}, {userName}
                    </h1>
                    <p className="mt-1 capitalize text-gray-500">{today}</p>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {isLoading ? (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                ) : (
                    <>
                        <MetricCard
                            label="Posts planeados"
                            value={weekStats.totalItems}
                            icon={<Calendar className="h-5 w-5 text-blue-500" />}
                            variant="neutral"
                        />
                        <MetricCard
                            label="Posts publicados"
                            value={weekStats.publishedItems}
                            icon={<CheckCircle className="h-5 w-5 text-green-500" />}
                            variant={
                                weekStats.publishedItems >= targetPostsPerWeek
                                    ? 'up'
                                    : 'neutral'
                            }
                            change={
                                weekStats.publishedItems >= targetPostsPerWeek
                                    ? `${weekStats.publishedItems}/${targetPostsPerWeek}`
                                    : undefined
                            }
                            changeLabel="do target"
                        />
                        <MetricCard
                            label="Artigos em rascunho"
                            value={draftArticles.length}
                            icon={<FileText className="h-5 w-5 text-gray-500" />}
                            variant={
                                draftArticles.length > 0 ? 'down' : 'neutral'
                            }
                        />
                        <MetricCard
                            label="Peças por aprovar"
                            value={pendingPieces.length}
                            icon={<Clock className="h-5 w-5 text-orange-500" />}
                            variant={pendingPieces.length > 0 ? 'down' : 'up'}
                            change={
                                pendingPieces.length > 0
                                    ? `${pendingPieces.length} pendentes`
                                    : 'Todas aprovadas'
                            }
                        />
                    </>
                )}
            </section>

            <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                Checklist da semana
                            </h2>
                            <span className="text-sm text-gray-500">
                                {weekStats.compliancePercent}% do plano
                            </span>
                        </div>

                        <div className="mb-4">
                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                <div
                                    className="h-full rounded-full bg-green-500 transition-all"
                                    style={{
                                        width: `${Math.min(
                                            weekStats.compliancePercent,
                                            100
                                        )}%`,
                                    }}
                                />
                            </div>
                        </div>

                        <WeekChecklist
                            items={dayChecklists.flatMap((d) => d.items)}
                            onMarkPublished={markItemPublished}
                            onRemove={removeItem}
                            isLoading={isLoading}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <Clock className="h-5 w-5 text-orange-500" />
                            Peças pendentes de aprovação
                        </h2>

                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
                                    >
                                        <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                                            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : pendingPieces.length === 0 ? (
                            <div className="rounded-lg bg-gray-50 p-4 text-center">
                                <p className="text-sm text-gray-500">
                                    Todas as peças estão aprovadas
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pendingPieces.map((piece) => (
                                    <div
                                        key={piece.id}
                                        className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                                    >
                                        <span className="text-xl">
                                            {formatIcons[piece.format] || '📄'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-900">
                                                {piece.title ||
                                                    `Post ${piece.format}`}
                                            </p>
                                            <div className="mt-1 flex items-center gap-2">
                                                {piece.channel && (
                                                    <ChannelBadge
                                                        channel={piece.channel.channel}
                                                        size="sm"
                                                        showLabel={false}
                                                    />
                                                )}
                                                {piece.pillar && (
                                                    <PillarBadge
                                                        pillar={piece.pillar}
                                                        size="sm"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => approvePiece(piece.id)}
                                            className="shrink-0 rounded bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200"
                                        >
                                            Aprovar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg bg-white p-6 shadow-sm">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                            <FileText className="h-5 w-5 text-gray-500" />
                            Artigos em rascunho
                        </h2>

                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="h-12 animate-pulse rounded bg-gray-100"
                                    />
                                ))}
                            </div>
                        ) : draftArticles.length === 0 ? (
                            <div className="rounded-lg bg-gray-50 p-4 text-center">
                                <p className="text-sm text-gray-500">
                                    Sem artigos em rascunho
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {draftArticles.map((article) => (
                                    <Link
                                        key={article.id}
                                        to={`/dashboard/articles/${article.id}/edit`}
                                        className="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-900">
                                                {article.title}
                                            </p>
                                            {article.pillar && (
                                                <div className="mt-1">
                                                    <PillarBadge
                                                        pillar={article.pillar.pillar}
                                                        size="sm"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <Edit className="h-4 w-4" />
                                            <ChevronRight className="h-4 w-4" />
                                        </div>
                                    </Link>
                                ))}
                                {draftArticles.length > 0 && (
                                    <Link
                                        to="/dashboard/articles"
                                        className="mt-2 flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                                    >
                                        Ver todos os artigos
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-lg bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <TrendingUp className="h-5 w-5 text-purple-500" />
                    Distribuição por pilar
                </h2>

                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="space-y-1">
                                <div className="flex justify-between">
                                    <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                                    <div className="h-4 w-10 animate-pulse rounded bg-gray-200" />
                                </div>
                                <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                            </div>
                        ))}
                    </div>
                ) : pillarDistribution.length === 0 ? (
                    <div className="rounded-lg bg-gray-50 p-4 text-center">
                        <p className="text-sm text-gray-500">
                            Configura os pilares nas configurações
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pillarDistribution.map((item) => (
                            <div key={item.pillar} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <PillarBadge pillar={item.pillar} size="sm" />
                                    <span className="text-sm text-gray-600">
                                        {item.count} artigo{item.count !== 1 ? 's' : ''} ({item.percentage}%)
                                    </span>
                                </div>
                                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                        className={`h-full rounded-full ${item.color} transition-all`}
                                        style={{ width: `${item.percentage}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
