import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ChannelBadge } from '@/components/channels/channel-badge';
import { PillarBadge } from '@/components/content/pillar-badge';
import { contentPieceService } from '@/services/content-piece.service';
import { articleService } from '@/services/article.service';
import type { ContentPieceWithRelations } from '@/types/database';
import type { ArticleWithRelations } from '@/types/database';
import type { SocialChannel, ContentPillar } from '@/types/database';
import { Search, Calendar, FileText, Image, Check, Clock } from 'lucide-react';
import { formatFullDate } from '@/lib/date-utils';

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (item: SelectedItem) => void;
    workspaceId: string;
    selectedDate: Date;
    dayOfWeek: number;
    pillarSuggestion?: ContentPillar | null;
}

export interface SelectedItem {
    type: 'content_piece' | 'article';
    id: string;
    title: string;
    format?: string;
    channel?: SocialChannel;
    pillar?: ContentPillar;
}

type TabType = 'pieces' | 'articles';

export function AddItemModal({
    isOpen,
    onClose,
    onSelect,
    workspaceId,
    selectedDate,
    dayOfWeek,
    pillarSuggestion,
}: AddItemModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('pieces');
    const [searchQuery, setSearchQuery] = useState('');
    const [contentPieces, setContentPieces] = useState<ContentPieceWithRelations[]>([]);
    const [articles, setArticles] = useState<ArticleWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, workspaceId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [piecesData, articlesData] = await Promise.all([
                contentPieceService.getWorkspaceContentPieces(workspaceId, {
                    status: 'APPROVED',
                }),
                articleService.getArticles(workspaceId, { status: 'ALL' }),
            ]);
            setContentPieces(piecesData);
            setArticles(articlesData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredPieces = contentPieces.filter((piece) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            piece.title?.toLowerCase().includes(query) ||
            piece.body.toLowerCase().includes(query) ||
            piece.format.toLowerCase().includes(query)
        );
    });

    const filteredArticles = articles.filter((article) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            article.title.toLowerCase().includes(query) ||
            article.body.toLowerCase().includes(query)
        );
    });

    const handleSelect = () => {
        if (selectedItem) {
            onSelect(selectedItem);
            handleClose();
        }
    };

    const handleClose = () => {
        setSelectedItem(null);
        setSearchQuery('');
        onClose();
    };

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
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Adicionar ao planeamento"
            size="lg"
        >
            <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-sm text-blue-700">
                        <strong>Data:</strong> {formatFullDate(selectedDate)} (
                        {dayOfWeek === 1 ? 'Segunda' : dayOfWeek === 3 ? 'Quarta' : dayOfWeek === 5 ? 'Sexta' : 'Dia ' + dayOfWeek})
                        {pillarSuggestion && (
                            <>
                                {' '}• <strong>Pilar:</strong>{' '}
                                <PillarBadge pillar={pillarSuggestion} size="sm" />
                            </>
                        )}
                    </p>
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
                        Peças aprovadas ({filteredPieces.length})
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

                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                    {isLoading ? (
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
                                            title: piece.title || `Post ${piece.format}`,
                                            format: piece.format,
                                            channel: piece.channel?.channel,
                                            pillar: piece.pillar || undefined,
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

                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <Button variant="outline" onClick={handleClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSelect}
                        disabled={!selectedItem}
                    >
                        <Check className="h-4 w-4" />
                        Adicionar
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

function ContentPieceItem({ piece, isSelected, onSelect }: ContentPieceItemProps) {
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
        <button
            onClick={onSelect}
            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
        >
            <span className="text-xl">{formatIcons[piece.format] || '📄'}</span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">
                        {piece.title || `Post ${piece.format}`}
                    </p>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="mt-1 flex items-center gap-2">
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
            <Calendar className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm">{message}</p>
        </div>
    );
}
