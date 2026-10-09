import { ContentPieceCard } from '@/components/content/content-piece-card';
import { ContentPieceModal } from '@/components/content/content-piece-modal';
import { useArticles } from '@/hooks/use-articles';
import { useGenerationJob } from '@/hooks/use-generation-job';
import { useWorkspaceContentPieces } from '@/hooks/use-workspace-content-pieces';
import { workspacePath } from '@/lib/workspace-paths';
import { ALL_CONTENT_FORMATS } from '@/helpers/content-format';
import { generationJobService } from '@/services/generation-job.service';
import { useGenerationJobStore } from '@/stores/generation-jobs-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type {
    ContentFormat,
    ContentPieceStatus,
    ContentPieceWithRelations,
    ContentSlide,
} from '@/types/database';
import {
    CONTENT_FORMAT_ICONS,
    CONTENT_FORMAT_LABELS,
} from '@/types/database';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'list' | 'grid';

/** Filtro de formato: o registo único, não uma cópia do enum. */
const ALL_FORMATS: ContentFormat[] = [...ALL_CONTENT_FORMATS];

const STATUS_OPTIONS: Array<{
    value: ContentPieceStatus | 'ALL';
    label: string;
}> = [
    { value: 'ALL', label: 'Todos' },
    { value: 'PROMPT_READY', label: 'Só com prompt' },
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
    // Peças só com prompt (PROMPT_READY) são estado de trabalho do artigo: por
    // omissão ficam fora desta listagem, que é de conteúdo publicável.
    const [showPromptOnly, setShowPromptOnly] = useState(false);
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
    const [isRewritingPromptRequest, setIsRewritingPromptRequest] =
        useState(false);
    const [rewriteMsg, setRewriteMsg] = useState<{
        ok: boolean;
        text: string;
    } | null>(null);
    const { currentWorkspace } = useWorkspaceStore();
    const rememberJob = useGenerationJobStore((s) => s.rememberJob);
    const navigate = useNavigate();

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
        updatePiece,
        approvePiece,
        deletePiece,
        regeneratePiece,
    } = useWorkspaceContentPieces(filters);

    // "Reescrever prompt" tem de ficar desligado enquanto o job corre. Com o
    // estado local sozinho, o `finally` limpava-o assim que o POST voltava e
    // dois cliques enfileiravam dois CONTENT_PROMPT para a mesma peça.
    const promptJob = useGenerationJob(
        editingPiece
            ? {
                  kind: 'target',
                  jobType: 'CONTENT_PROMPT',
                  targetId: editingPiece.articleId,
              }
            : null
    );
    const isRewritingPrompt =
        isRewritingPromptRequest || promptJob.isActive;
    // O aviso de "a escrever o prompt" é da peça aberta — trocando de peça
    // tinha de desaparecer, senão a mensagem da peça anterior ficava à vista.
    useEffect(() => {
        setRewriteMsg(null);
    }, [editingPiece?.id]);

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
        if (statusFilter !== 'PROMPT_READY' && !showPromptOnly) {
            if (piece.status === 'PROMPT_READY') return false;
        }
        return true;
    });

    // O filtro de estado e o checkbox dizem a mesma coisa. Sem isto, marcar
    // "PROMPT_READY" no filtro e depois trocar de filtro deixava o checkbox
    // ligado — e as peças só com prompt continuavam visíveis sem ser pedido.
    useEffect(() => {
        setShowPromptOnly(statusFilter === 'PROMPT_READY');
    }, [statusFilter]);

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

    // Reescreve o prompt da peça em edição (job CONTENT_PROMPT). O modal do
    // artigo faz o mesmo; aqui só falta o botão para não obrigar a voltar ao
    // artigo sempre que se quer mudar o prompt.
    const handleRewritePrompt = async () => {
        if (!editingPiece || !currentWorkspace) return;
        if (isRewritingPrompt) return;

        setRewriteMsg(null);
        setIsRewritingPromptRequest(true);
        try {
            const result = await generationJobService.enqueue({
                workspaceId: currentWorkspace.id,
                jobType: 'CONTENT_PROMPT',
                params: {
                    articleId: editingPiece.articleId,
                    formats: [editingPiece.format],
                    // Sem isto o prompt saía sem produto e sem o canal da
                    // peça — diferente do que o painel do artigo produz.
                    productId: editingPiece.productId ?? null,
                    channelIds: editingPiece.channelId
                        ? [editingPiece.channelId]
                        : [],
                },
                targets: [
                    {
                        format: editingPiece.format,
                        targetId: editingPiece.id,
                    },
                ],
            });
            rememberJob({
                jobType: 'CONTENT_PROMPT',
                targetId: editingPiece.articleId,
                jobId: result.jobId,
            });
            setRewriteMsg({
                ok: true,
                text: 'A escrever o prompt em segundo plano. A caixa actualiza-se sozinha quando terminar.',
            });
        } catch (err) {
            setRewriteMsg({
                ok: false,
                text: err instanceof Error
                    ? err.message
                    : 'Erro ao reescrever o prompt.',
            });
        } finally {
            setIsRewritingPromptRequest(false);
        }
    };

    const handleSave = async (data: {
        title: string | null;
        body: string;
        hookText: string | null;
        ctaText: string | null;
        hashtags: string[];
        slides: ContentSlide[] | null;
        channelId: string | null;
    }) => {
        if (!editingPiece) return;
        setIsSaving(true);
        try {
            await updatePiece(editingPiece.id, {
                title: data.title,
                body: data.body,
                hookText: data.hookText,
                ctaText: data.ctaText,
                hashtags: data.hashtags,
                slides: data.slides,
                slideCount: data.slides?.length || null,
                channelId: data.channelId,
            });
            setEditingPiece(null);
        } finally {
            setIsSaving(false);
        }
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
                        <span className="font-medium">
                            {filteredPieces.length}
                        </span>{' '}
                        total
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

                <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                        type="checkbox"
                        checked={showPromptOnly}
                        onChange={(e) => setShowPromptOnly(e.target.checked)}
                        disabled={statusFilter === 'PROMPT_READY'}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Incluir peças só com prompt
                </label>

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
                            onOpen={() => {
                                navigate(
                                    workspacePath(
                                        currentWorkspace?.id ?? '',
                                        `content/${piece.id}`
                                    )
                                );
                            }}
                            isApproving={approvingIds.has(piece.id)}
                            isRegenerating={regeneratingIds.has(piece.id)}
                        />
                    ))}
                </div>
            )}

            {/* Modal único de edição (partilhado com o editor de artigo). O
                overlay inline anterior — com auto-save e editor próprio — foi
                removido. */}
            <ContentPieceModal
                isOpen={editingPiece !== null}
                onClose={() => setEditingPiece(null)}
                piece={editingPiece}
                onSave={handleSave}
                onRewritePrompt={handleRewritePrompt}
                isRewritingPrompt={isRewritingPrompt}
                isSaving={isSaving}
            />

            {rewriteMsg && !editingPiece && (
                <p
                    className={`text-sm ${
                        rewriteMsg.ok ? 'text-green-700' : 'text-red-700'
                    }`}
                >
                    {rewriteMsg.text}
                </p>
            )}
        </div>
    );
}
