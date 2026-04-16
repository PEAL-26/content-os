import { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ChannelBadge } from '@/components/channels/channel-badge';
import { PillarBadge } from '@/components/content/pillar-badge';
import { contentPieceService } from '@/services/content-piece.service';
import { articleService } from '@/services/article.service';
import { pillarService } from '@/services/pillar.service';
import { channelService } from '@/services/channel.service';
import type { ContentPieceWithRelations, ContentPillar } from '@/types/database';
import type { ArticleWithRelations } from '@/types/database';
import type { PillarConfig } from '@/types/pillar';
import type { ChannelConfig } from '@/types/database';
import { Search, FileText, Image, Check, Clock, Filter, X } from 'lucide-react';
import { formatFullDate, getPillarLabel } from '@/lib/date-utils';
import { CONTENT_FORMAT_EMOJIS } from '@/helpers/content-format';

interface AddPlanItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (item: AddItemData) => void;
    workspaceId: string;
    selectedDate: Date;
    dayOfWeek: number;
    pillarSuggestion?: ContentPillar | null;
    isLoading?: boolean;
}

export interface AddItemData {
    type: 'content_piece' | 'article';
    contentPieceId?: string;
    articleId?: string;
    channelId?: string;
    pillarId?: string;
    scheduledTime: string;
    notes?: string;
}

type TabType = 'pieces' | 'articles';

export function AddPlanItemModal({
    isOpen,
    onClose,
    onAdd,
    workspaceId,
    selectedDate,
    dayOfWeek,
    pillarSuggestion,
    isLoading = false,
}: AddPlanItemModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('pieces');
    const [searchQuery, setSearchQuery] = useState('');
    const [contentPieces, setContentPieces] = useState<ContentPieceWithRelations[]>([]);
    const [articles, setArticles] = useState<ArticleWithRelations[]>([]);
    const [pillars, setPillars] = useState<PillarConfig[]>([]);
    const [channels, setChannels] = useState<ChannelConfig[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const [filterChannel, setFilterChannel] = useState<string>('');
    const [filterPillar, setFilterPillar] = useState<string>('');

    const [selectedItem, setSelectedItem] = useState<{
        type: 'content_piece' | 'article';
        id: string;
        title: string;
        channelId?: string;
        pillarId?: string;
    } | null>(null);

    const [scheduledTime, setScheduledTime] = useState('09:00');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData should only run on open/workspace change
    }, [isOpen, workspaceId]);

    useEffect(() => {
        if (selectedItem?.type === 'content_piece' && selectedItem.channelId) {
            setFilterChannel(selectedItem.channelId);
        }
    }, [selectedItem]);

    const loadData = async () => {
        setIsLoadingData(true);
        try {
            const [piecesData, articlesData, pillarsData, channelsData] =
                await Promise.all([
                    contentPieceService.getWorkspaceContentPieces(workspaceId, {
                        status: 'APPROVED',
                    }),
                    articleService.getArticles(workspaceId, {
                        status: 'ALL',
                    }),
                    pillarService.getPillars(workspaceId),
                    channelService.getChannels(workspaceId),
                ]);
            setContentPieces(piecesData);
            setArticles(articlesData);
            setPillars(pillarsData);
            setChannels(channelsData.filter((c) => c.isActive));
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoadingData(false);
        }
    };

    const filteredPieces = useMemo(() => {
        return contentPieces.filter((piece) => {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (
                    !piece.title?.toLowerCase().includes(query) &&
                    !piece.body.toLowerCase().includes(query) &&
                    !piece.format.toLowerCase().includes(query)
                ) {
                    return false;
                }
            }
            if (filterChannel && piece.channelId !== filterChannel) {
                return false;
            }
            if (filterPillar && piece.pillar !== filterPillar) {
                return false;
            }
            return true;
        });
    }, [contentPieces, searchQuery, filterChannel, filterPillar]);

    const filteredArticles = useMemo(() => {
        return articles.filter((article) => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                article.title.toLowerCase().includes(query) ||
                article.body.toLowerCase().includes(query)
            );
        });
    }, [articles, searchQuery]);

    const clearFilters = () => {
        setFilterChannel('');
        setFilterPillar('');
        setSearchQuery('');
    };

    const hasActiveFilters = filterChannel || filterPillar || searchQuery;

    const handleAdd = () => {
        if (!selectedItem) return;

        onAdd({
            type: selectedItem.type,
            contentPieceId:
                selectedItem.type === 'content_piece'
                    ? selectedItem.id
                    : undefined,
            articleId:
                selectedItem.type === 'article'
                    ? selectedItem.id
                    : undefined,
            channelId: selectedItem.channelId,
            pillarId: selectedItem.pillarId,
            scheduledTime,
            notes: notes || undefined,
        });
        handleClose();
    };

    const handleClose = () => {
        setSelectedItem(null);
        setSearchQuery('');
        setFilterChannel('');
        setFilterPillar('');
        setScheduledTime('09:00');
        setNotes('');
        onClose();
    };

    const dayNames: Record<number, string> = {
        1: 'Segunda',
        2: 'Terça',
        3: 'Quarta',
        4: 'Quinta',
        5: 'Sexta',
        6: 'Sábado',
        7: 'Domingo',
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Adicionar ao planeamento"
            size="lg"
        >
            <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 p-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-blue-700">
                            <strong>Data:</strong> {formatFullDate(selectedDate)} (
                            {dayNames[dayOfWeek] || `Dia ${dayOfWeek}`})
                        </p>
                        {pillarSuggestion && (
                            <PillarBadge pillar={pillarSuggestion} size="sm" />
                        )}
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div className="flex gap-2 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('pieces')}
                        className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'pieces'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Image className="h-4 w-4" />
                        Peças de conteúdo ({filteredPieces.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('articles')}
                        className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'articles'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <FileText className="h-4 w-4" />
                        Artigos ({filteredArticles.length})
                    </button>
                </div>

                {activeTab === 'pieces' && (
                    <div className="flex flex-wrap gap-2 rounded-lg bg-gray-50 p-2">
                        <div className="flex items-center gap-1">
                            <Filter className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">Filtros:</span>
                        </div>
                        <select
                            value={filterChannel}
                            onChange={(e) => setFilterChannel(e.target.value)}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">Canal (todos)</option>
                            {channels.map((channel) => (
                                <option key={channel.id} value={channel.id}>
                                    {channel.channel}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filterPillar}
                            onChange={(e) => setFilterPillar(e.target.value)}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">Pilar (todos)</option>
                            {pillars.map((pillar) => (
                                <option key={pillar.id} value={pillar.pillar}>
                                    {getPillarLabel(pillar.pillar)}
                                </option>
                            ))}
                        </select>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                            >
                                <X className="h-3 w-3" />
                                Limpar
                            </button>
                        )}
                    </div>
                )}

                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                    {isLoadingData ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        </div>
                    ) : activeTab === 'pieces' ? (
                        filteredPieces.length === 0 ? (
                            <EmptyState message="Nenhuma peça aprovada encontrada" />
                        ) : (
                            filteredPieces.map((piece) => (
                                <ContentPieceItem
                                    key={piece.id}
                                    piece={piece}
                                    isSelected={selectedItem?.id === piece.id}
                                    onSelect={() =>
                                        setSelectedItem({
                                            type: 'content_piece',
                                            id: piece.id,
                                            title:
                                                piece.title ||
                                                `Post ${piece.format}`,
                                            channelId: piece.channelId || undefined,
                                            pillarId: piece.pillar || undefined,
                                        })
                                    }
                                />
                            ))
                        )
                    ) : filteredArticles.length === 0 ? (
                        <EmptyState message="Nenhum artigo encontrado" />
                    ) : (
                        filteredArticles.map((article) => (
                            <ArticleItem
                                key={article.id}
                                article={article}
                                isSelected={selectedItem?.id === article.id}
                                onSelect={() =>
                                    setSelectedItem({
                                        type: 'article',
                                        id: article.id,
                                        title: article.title,
                                    })
                                }
                            />
                        ))
                    )}
                </div>

                {selectedItem && (
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <h4 className="text-sm font-medium text-gray-700">
                            Detalhes do agendamento
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Hora de publicação
                                </label>
                                <input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) =>
                                        setScheduledTime(e.target.value)
                                    }
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Canal alvo
                                </label>
                                <select
                                    value={
                                        selectedItem.channelId ||
                                        filterChannel ||
                                        ''
                                    }
                                    onChange={(e) =>
                                        setSelectedItem({
                                            ...selectedItem,
                                            channelId: e.target.value,
                                        })
                                    }
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">Selecionar canal</option>
                                    {channels.map((channel) => (
                                        <option
                                            key={channel.id}
                                            value={channel.id}
                                        >
                                            {channel.channel}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">
                                Notas (opcional)
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Adicionar notas..."
                                rows={2}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <Button variant="outline" onClick={handleClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleAdd} disabled={!selectedItem || isLoading}>
                        <Check className="h-4 w-4" />
                        {isLoading ? 'A adicionar...' : 'Adicionar'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

interface ContentPieceItemProps {
    piece: ContentPieceWithRelations;
    isSelected: boolean;
    onSelect: () => void;
}

function ContentPieceItem({
    piece,
    isSelected,
    onSelect,
}: ContentPieceItemProps) {
    return (
        <button
            onClick={onSelect}
            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
        >
            <span className="text-xl">{CONTENT_FORMAT_EMOJIS[piece.format] || '📄'}</span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">
                        {piece.title || `Post ${piece.format}`}
                    </p>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    {piece.channel && (
                        <ChannelBadge
                            channel={piece.channel.channel}
                            size="sm"
                            showLabel={true}
                        />
                    )}
                    {piece.pillar && (
                        <PillarBadge pillar={piece.pillar} size="sm" />
                    )}
                </div>
                {piece.article && (
                    <p className="mt-1 truncate text-xs text-gray-500">
                        De: {piece.article.title}
                    </p>
                )}
            </div>
        </button>
    );
}

interface ArticleItemProps {
    article: ArticleWithRelations;
    isSelected: boolean;
    onSelect: () => void;
}

function ArticleItem({ article, isSelected, onSelect }: ArticleItemProps) {
    const statusColors: Record<string, string> = {
        DRAFT: 'bg-gray-100 text-gray-700',
        REVIEW: 'bg-yellow-100 text-yellow-700',
        APPROVED: 'bg-green-100 text-green-700',
        PUBLISHED: 'bg-blue-100 text-blue-700',
    };

    return (
        <button
            onClick={onSelect}
            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
        >
            <FileText className="h-5 w-5 text-gray-400" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">
                        {article.title}
                    </p>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            statusColors[article.status]
                        }`}
                    >
                        {article.status}
                    </span>
                    {article.readingTimeMin && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            {article.readingTimeMin} min
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <FileText className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm">{message}</p>
        </div>
    );
}
