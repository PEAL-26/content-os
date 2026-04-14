import { Modal } from '@/components/ui/modal';
import { VideoScriptCard } from '@/components/content/video-script-card';
import { useVideoScripts } from '@/hooks/use-video-scripts';
import { useArticles } from '@/hooks/use-articles';
import type { ArticleStatus, SocialChannel } from '@/types/database';
import { useState } from 'react';

const STATUS_OPTIONS: Array<{ value: ArticleStatus | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'Todos' },
    { value: 'DRAFT', label: 'Rascunho' },
    { value: 'APPROVED', label: 'Aprovado' },
    { value: 'PUBLISHED', label: 'Publicado' },
];

const CHANNEL_OPTIONS: Array<{ value: SocialChannel | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'Todos os canais' },
    { value: 'TIKTOK', label: 'TikTok' },
    { value: 'INSTAGRAM', label: 'Instagram' },
    { value: 'YOUTUBE', label: 'YouTube' },
];

const DURATION_OPTIONS = [
    { value: 30, label: '30 segundos' },
    { value: 60, label: '60 segundos' },
    { value: 90, label: '90 segundos' },
    { value: 120, label: '120 segundos' },
];

export function VideoScriptsPage() {
    const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'ALL'>('ALL');
    const [channelFilter, setChannelFilter] = useState<SocialChannel | 'ALL'>('ALL');
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [selectedArticleId, setSelectedArticleId] = useState<string>('');
    const [selectedChannel, setSelectedChannel] = useState<SocialChannel>('TIKTOK');
    const [selectedDuration, setSelectedDuration] = useState(60);
    const [articleSearch, setArticleSearch] = useState('');
    const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

    const filters = {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        targetChannel: channelFilter !== 'ALL' ? channelFilter : undefined,
    };

    const {
        scripts,
        isLoading,
        isGenerating,
        error,
        approvedCount,
        totalCount,
        generateScript,
        approveScript,
        deleteScript,
    } = useVideoScripts(filters);

    const { articles } = useArticles({
        filters: {
            status: 'ALL',
            pillarId: null,
            productId: null,
            search: articleSearch,
        },
    });

    const handleGenerate = async () => {
        if (!selectedArticleId) return;

        const result = await generateScript({
            articleId: selectedArticleId,
            targetChannel: selectedChannel,
            durationSec: selectedDuration,
        });

        if (result.success) {
            setShowGenerateModal(false);
            setSelectedArticleId('');
            setArticleSearch('');
        } else {
            alert(result.error || 'Erro ao gerar roteiro');
        }
    };

    const handleApprove = async (id: string) => {
        setApprovingIds((prev) => new Set(prev).add(id));
        await approveScript(id);
        setApprovingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tens a certeza que queres eliminar este roteiro?')) {
            await deleteScript(id);
        }
    };

    const selectedArticle = articles.find((a) => a.id === selectedArticleId);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Roteiros de Vídeo
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        <span className="font-medium text-green-600">{approvedCount}</span>{' '}
                        roteiros aprovados /{' '}
                        <span className="font-medium">{totalCount}</span> total
                    </p>
                </div>
                <button
                    onClick={() => setShowGenerateModal(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
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
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    Gerar Roteiro
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) =>
                        setStatusFilter(e.target.value as ArticleStatus | 'ALL')
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>

                <select
                    value={channelFilter}
                    onChange={(e) =>
                        setChannelFilter(e.target.value as SocialChannel | 'ALL')
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    {CHANNEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
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
            ) : scripts.length === 0 ? (
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
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        Ainda não tens roteiros de vídeo
                    </h3>
                    <p className="mt-2 max-w-sm text-sm text-gray-500">
                        Gera roteiros de vídeo curtos para TikTok e Instagram a partir dos
                        teus artigos.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {scripts.map((script) => (
                        <VideoScriptCard
                            key={script.id}
                            script={script}
                            onApprove={() => handleApprove(script.id)}
                            onDelete={() => handleDelete(script.id)}
                            isApproving={approvingIds.has(script.id)}
                        />
                    ))}
                </div>
            )}

            <Modal
                isOpen={showGenerateModal}
                onClose={() => {
                    setShowGenerateModal(false);
                    setSelectedArticleId('');
                    setArticleSearch('');
                }}
                title="Gerar Roteiro de Vídeo"
                size="md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Artigo de origem *
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={articleSearch}
                                onChange={(e) => {
                                    setArticleSearch(e.target.value);
                                    setSelectedArticleId('');
                                }}
                                placeholder="Pesquisar artigo..."
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {articleSearch && articles.length > 0 && (
                                <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                                    {articles.slice(0, 10).map((article) => (
                                        <button
                                            key={article.id}
                                            onClick={() => {
                                                setSelectedArticleId(article.id);
                                                setArticleSearch(article.title);
                                            }}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                        >
                                            {article.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedArticleId && (
                            <p className="mt-1 text-xs text-green-600">
                                ✓ Artigo selecionado: {selectedArticle?.title}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Canal alvo *
                        </label>
                        <div className="flex gap-2">
                            {CHANNEL_OPTIONS.filter((c) => c.value !== 'ALL').map(
                                (opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() =>
                                            setSelectedChannel(opt.value as SocialChannel)
                                        }
                                        className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                            selectedChannel === opt.value
                                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Duração alvo *
                        </label>
                        <div className="flex gap-2">
                            {DURATION_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSelectedDuration(opt.value)}
                                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                                        selectedDuration === opt.value
                                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <button
                            onClick={() => {
                                setShowGenerateModal(false);
                                setSelectedArticleId('');
                                setArticleSearch('');
                            }}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={!selectedArticleId || isGenerating}
                            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {isGenerating ? (
                                <>
                                    <svg
                                        className="h-4 w-4 animate-spin"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                        />
                                    </svg>
                                    A gerar...
                                </>
                            ) : (
                                'Gerar Roteiro'
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
