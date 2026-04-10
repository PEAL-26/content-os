import { ContentPieceCard } from '@/components/content/content-piece-card';
import { ContentPieceEditor } from '@/components/content/content-piece-editor';
import { useArticles } from '@/hooks/use-articles';
import { useWorkspaceContentPieces } from '@/hooks/use-workspace-content-pieces';
import type {
    ContentFormat,
    ContentPieceStatus,
    ContentPieceWithRelations,
} from '@/types/database';
import { CONTENT_FORMAT_ICONS, CONTENT_FORMAT_LABELS } from '@/types/database';
import { useState } from 'react';

type ViewMode = 'list' | 'grid';

const ALL_FORMATS: ContentFormat[] = [
    'CAROUSEL',
    'LINKEDIN_POST',
    'IMAGE',
    'SHORT_VIDEO',
    'CTA_POST',
    'THREAD',
    'VIDEO_SCRIPT',
];

const STATUS_OPTIONS: Array<{
    value: ContentPieceStatus | 'ALL';
    label: string;
}> = [
    { value: 'ALL', label: 'Todos' },
    { value: 'DRAFT', label: 'Rascunho' },
    { value: 'APPROVED', label: 'Aprovado' },
    { value: 'SCHEDULED', label: 'Agendado' },
    { value: 'PUBLISHED', label: 'Publicado' },
];

export function ContentPiecesPage() {
    const [formatFilter, setFormatFilter] = useState<ContentFormat | 'ALL'>(
        'ALL'
    );
    const [statusFilter, setStatusFilter] = useState<
        ContentPieceStatus | 'ALL'
    >('ALL');
    const [articleFilter, setArticleFilter] = useState<string>('');
    const [channelFilter, setChannelFilter] = useState<string>('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [editingPiece, setEditingPiece] =
        useState<ContentPieceWithRelations | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
    const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(
        new Set()
    );
    const [searchArticle, setSearchArticle] = useState('');

    const filters = {
        format: formatFilter !== 'ALL' ? formatFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        articleId: articleFilter || undefined,
    };

    const {
        pieces,
        isLoading,
        error,
        approvedCount,
        totalCount,
        updatePiece,
        approvePiece,
        deletePiece,
        regeneratePiece,
    } = useWorkspaceContentPieces(filters);

    const { articles } = useArticles({
        filters: {
            status: 'ALL',
            pillarId: null,
            productId: null,
            search: searchArticle,
        },
    });

    const filteredPieces = pieces.filter((piece) => {
        if (channelFilter && piece.channelId !== channelFilter) return false;
        return true;
    });

    const handleApprove = async (id: string) => {
        setApprovingIds((prev) => new Set(prev).add(id));
        await approvePiece(id);
        setApprovingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleRegenerate = async (piece: ContentPieceWithRelations) => {
        setRegeneratingIds((prev) => new Set(prev).add(piece.id));
        const result = await regeneratePiece(piece);
        if (!result.success) {
            alert(result.error || 'Erro ao regenerar peça');
        }
        setRegeneratingIds((prev) => {
            const next = new Set(prev);
            next.delete(piece.id);
            return next;
        });
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tens a certeza que queres eliminar esta peça?')) {
            await deletePiece(id);
        }
    };

    const handleSave = async (data: {
        body: string;
        hookText: string | null;
        ctaText: string | null;
        hashtags: string[];
        slides: { order: number; title: string; body: string }[] | null;
    }) => {
        if (!editingPiece) return;
        setIsSaving(true);
        await updatePiece(editingPiece.id, {
            body: data.body,
            hookText: data.hookText,
            ctaText: data.ctaText,
            hashtags: data.hashtags,
            slides: data.slides,
            slideCount: data.slides?.length || null,
        });
        setIsSaving(false);
        setEditingPiece(null);
    };

    const uniqueChannels = Array.from(
        new Set(pieces.filter((p) => p.channel).map((p) => p.channel!.id))
    ).map((id) => {
        const piece = pieces.find((p) => p.channelId === id);
        return { id, channel: piece?.channel };
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Peças de Conteúdo
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        <span className="font-medium text-green-600">
                            {approvedCount}
                        </span>{' '}
                        peças aprovadas /{' '}
                        <span className="font-medium">{totalCount}</span> total
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`rounded-md p-2 ${viewMode === 'list' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}
                        title="Vista de lista"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`rounded-md p-2 ${viewMode === 'grid' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}
                        title="Vista de grelha"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={formatFilter}
                    onChange={(e) =>
                        setFormatFilter(e.target.value as ContentFormat | 'ALL')
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                    <option value="ALL">Todos os formatos</option>
                    {ALL_FORMATS.map((format) => (
                        <option key={format} value={format}>
                            {CONTENT_FORMAT_ICONS[format]}{' '}
                            {CONTENT_FORMAT_LABELS[format]}
                        </option>
                    ))}
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) =>
                        setStatusFilter(
                            e.target.value as ContentPieceStatus | 'ALL'
                        )
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                    {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>

                <div className="relative min-w-[200px]">
                    <input
                        type="text"
                        value={searchArticle}
                        onChange={(e) => setSearchArticle(e.target.value)}
                        placeholder="Pesquisar artigo..."
                        className="w-full rounded-md border border-gray-300 px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    {searchArticle && articles.length > 0 && (
                        <div className="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                            {articles.slice(0, 10).map((article) => (
                                <button
                                    key={article.id}
                                    onClick={() => {
                                        setArticleFilter(article.id);
                                        setSearchArticle(article.title);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                >
                                    {article.title}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {articleFilter && (
                    <button
                        onClick={() => {
                            setArticleFilter('');
                            setSearchArticle('');
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
                        Limpar filtro
                    </button>
                )}

                {uniqueChannels.length > 0 && (
                    <select
                        value={channelFilter}
                        onChange={(e) => setChannelFilter(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="">Todos os canais</option>
                        {uniqueChannels.map((ch) => (
                            <option key={ch.id} value={ch.id}>
                                {ch.channel?.channel}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {error && (
                <div className="rounded-md bg-red-50 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                </div>
            ) : filteredPieces.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                        <svg
                            className="h-8 w-8 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        Ainda não tens peças de conteúdo
                    </h3>
                    <p className="mt-2 max-w-sm text-sm text-gray-500">
                        Gera peças de conteúdo a partir dos teus artigos para
                        veres aqui.
                    </p>
                </div>
            ) : (
                <div
                    className={
                        viewMode === 'grid'
                            ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
                            : 'space-y-4'
                    }
                >
                    {filteredPieces.map((piece) => (
                        <ContentPieceCard
                            key={piece.id}
                            piece={piece}
                            onApprove={() => handleApprove(piece.id)}
                            onRegenerate={() => handleRegenerate(piece)}
                            onEdit={() => setEditingPiece(piece)}
                            onDelete={() => handleDelete(piece.id)}
                            isApproving={approvingIds.has(piece.id)}
                            isRegenerating={regeneratingIds.has(piece.id)}
                        />
                    ))}
                </div>
            )}

            {editingPiece && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div
                            className="fixed inset-0 bg-black/50"
                            onClick={() => setEditingPiece(null)}
                        />
                        <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
                            <div className="flex items-center justify-between border-b px-6 py-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Editar:{' '}
                                    {CONTENT_FORMAT_LABELS[editingPiece.format]}
                                </h3>
                                <button
                                    onClick={() => setEditingPiece(null)}
                                    className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                >
                                    <svg
                                        className="h-5 w-5"
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
                            </div>
                            <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-4">
                                <ContentPieceEditor
                                    piece={editingPiece}
                                    onSave={handleSave}
                                    isSaving={isSaving}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
