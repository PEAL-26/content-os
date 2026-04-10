import { ChannelBadge } from '@/components/channels/channel-badge';
import { useChannels } from '@/hooks/use-channels';
import { useContentPieces } from '@/hooks/use-content-pieces';
import type {
    Article,
    ContentFormat,
    ContentPieceWithRelations,
    Product,
} from '@/types/database';
import {
    CHANNEL_LABELS,
    CONTENT_FORMAT_DEFAULTS,
    CONTENT_FORMAT_LABELS,
    CONTENT_PIECE_STATUS_COLORS,
    CONTENT_PIECE_STATUS_LABELS,
} from '@/types/database';
import type { PillarConfig } from '@/types/pillar';
import { useMemo, useState } from 'react';
import { ContentPieceModal } from './content-piece-modal';

interface ContentGeneratorPanelProps {
    article: Article;
    product?: Product;
    pillar?: PillarConfig;
}

const ALL_FORMATS: ContentFormat[] = [
    'CAROUSEL',
    'LINKEDIN_POST',
    'IMAGE',
    'SHORT_VIDEO',
    'CTA_POST',
    'THREAD',
    'VIDEO_SCRIPT',
];

const FORMAT_ICONS: Record<ContentFormat, string> = {
    CAROUSEL: '📱',
    LINKEDIN_POST: '💼',
    IMAGE: '📸',
    SHORT_VIDEO: '🎬',
    CTA_POST: '🔗',
    THREAD: '🧵',
    VIDEO_SCRIPT: '📝',
};

export function ContentGeneratorPanel({
    article,
    product,
    pillar,
}: ContentGeneratorPanelProps) {
    const {
        pieces,
        isGenerating,
        generatingFormats,
        generatePieces,
        updatePiece,
        approvePiece,
        deletePiece,
    } = useContentPieces(article.id);

    const { channels } = useChannels();

    const [errors, setErrors] = useState<
        { format: ContentFormat; message: string }[]
    >([]);
    const [selectedFormats, setSelectedFormats] = useState<Set<ContentFormat>>(
        new Set(['CAROUSEL', 'LINKEDIN_POST'])
    );
    const [selectedChannels, setSelectedChannels] = useState<
        Partial<Record<ContentFormat, string>>
    >({});
    const [editingPiece, setEditingPiece] =
        useState<ContentPieceWithRelations | null>(null);
    const [isSavingModal, setIsSavingModal] = useState(false);

    const piecesByFormat = useMemo(() => {
        const map = new Map<ContentFormat, ContentPieceWithRelations[]>();
        pieces.forEach((piece) => {
            const existing = map.get(piece.format) || [];
            map.set(piece.format, [...existing, piece]);
        });
        return map;
    }, [pieces]);

    const toggleFormat = (format: ContentFormat) => {
        setSelectedFormats((prev) => {
            const next = new Set(prev);
            if (next.has(format)) {
                next.delete(format);
            } else {
                next.add(format);
            }
            return next;
        });
    };

    const handleChannelChange = (format: ContentFormat, channelId: string) => {
        setSelectedChannels((prev) => ({
            ...prev,
            [format]: channelId,
        }));
    };

    const getDefaultChannel = (format: ContentFormat): string => {
        const defaultChannel = CONTENT_FORMAT_DEFAULTS[format];
        const matchingChannel = channels.find(
            (c) => c.channel === defaultChannel
        );
        return matchingChannel?.id || channels[0]?.id || '';
    };

    const handleGenerate = async () => {
        if (selectedFormats.size === 0) return;

        setErrors([]);

        const channelIds: Partial<Record<ContentFormat, string>> = {};
        for (const format of selectedFormats) {
            channelIds[format] =
                selectedChannels[format] || getDefaultChannel(format);
        }

        const result = await generatePieces({
            article,
            formats: Array.from(selectedFormats),
            channelIds,
            product,
            pillar,
        });

        if (result.errors.length > 0) {
            setErrors(
                result.errors.map((e) => ({
                    format: e.format,
                    message: e.error,
                }))
            );
        }
    };

    const handleSavePiece = async (data: {
        title: string | null;
        body: string;
        hookText: string | null;
        ctaText: string | null;
        hashtags: string[];
        slides: { order: number; title: string; body: string }[] | null;
        channelId: string | null;
    }) => {
        if (!editingPiece) return;

        setIsSavingModal(true);
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
        setIsSavingModal(false);
        setEditingPiece(null);
    };

    const handleDeletePiece = async (id: string) => {
        if (confirm('Tens a certeza que queres eliminar esta peça?')) {
            await deletePiece(id);
        }
    };

    const handleApprovePiece = async (id: string) => {
        await approvePiece(id);
    };

    const groupedPieces = useMemo(() => {
        const groups: Array<{
            format: ContentFormat;
            pieces: ContentPieceWithRelations[];
        }> = [];

        for (const format of ALL_FORMATS) {
            const formatPieces = piecesByFormat.get(format);
            if (formatPieces && formatPieces.length > 0) {
                groups.push({ format, pieces: formatPieces });
            }
        }

        return groups;
    }, [piecesByFormat]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                    Selecionar formatos a gerar
                </h3>
                <div className="space-y-2">
                    {ALL_FORMATS.map((format) => {
                        const isSelected = selectedFormats.has(format);
                        const channelId =
                            selectedChannels[format] ||
                            getDefaultChannel(format);

                        return (
                            <div
                                key={format}
                                className="flex h-10 items-center gap-3 rounded-md border border-gray-200 p-3"
                            >
                                <input
                                    type="checkbox"
                                    id={`format-${format}`}
                                    checked={isSelected}
                                    onChange={() => toggleFormat(format)}
                                    disabled={isGenerating}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label
                                    htmlFor={`format-${format}`}
                                    className="flex-1 cursor-pointer text-sm"
                                >
                                    <span className="mr-2">
                                        {FORMAT_ICONS[format]}
                                    </span>
                                    {CONTENT_FORMAT_LABELS[format]}
                                </label>
                                {isSelected && (
                                    <select
                                        value={channelId}
                                        onChange={(e) =>
                                            handleChannelChange(
                                                format,
                                                e.target.value
                                            )
                                        }
                                        disabled={isGenerating}
                                        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                    >
                                        {channels.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {CHANNEL_LABELS[c.channel]}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <button
                onClick={handleGenerate}
                disabled={
                    isGenerating ||
                    selectedFormats.size === 0 ||
                    channels.length === 0
                }
                className="w-full rounded-md bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
                {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
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
                        {Array.from(generatingFormats)
                            .map((f) => CONTENT_FORMAT_LABELS[f])
                            .join(', ')}
                    </span>
                ) : (
                    <>Gerar {selectedFormats.size} peça(s)</>
                )}
            </button>

            {errors.map((error, index) => (
                <p key={index} className="text-xs text-red-600">
                    {error.message}
                </p>
            ))}

            {channels.length === 0 && (
                <p className="text-xs text-amber-600">
                    Configura pelo menos um canal em Settings para gerar
                    conteúdo.
                </p>
            )}

            {groupedPieces.length > 0 && (
                <div>
                    <h3 className="mb-3 text-sm font-medium text-gray-700">
                        Peças geradas
                    </h3>
                    <div className="space-y-3">
                        {groupedPieces.map(
                            ({ format, pieces: formatPieces }) => (
                                <div key={format}>
                                    <h4 className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
                                        <span>{FORMAT_ICONS[format]}</span>
                                        {CONTENT_FORMAT_LABELS[format]} (
                                        {formatPieces.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {formatPieces.map((piece) => (
                                            <ContentPieceCard
                                                key={piece.id}
                                                piece={piece}
                                                onEdit={() =>
                                                    setEditingPiece(piece)
                                                }
                                                onDelete={() =>
                                                    handleDeletePiece(piece.id)
                                                }
                                                onApprove={() =>
                                                    handleApprovePiece(piece.id)
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            <ContentPieceModal
                isOpen={!!editingPiece}
                onClose={() => setEditingPiece(null)}
                piece={editingPiece}
                onSave={handleSavePiece}
                isSaving={isSavingModal}
            />
        </div>
    );
}

function ContentPieceCard({
    piece,
    onEdit,
    onDelete,
    onApprove,
}: {
    piece: ContentPieceWithRelations;
    onEdit: () => void;
    onDelete: () => void;
    onApprove: () => void;
}) {
    const statusColors = CONTENT_PIECE_STATUS_COLORS[piece.status];

    return (
        <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                        {piece.title || 'Sem título'}
                    </p>
                    {piece.channel && (
                        <div className="mt-1">
                            <ChannelBadge
                                channel={piece.channel.channel}
                                size="sm"
                            />
                        </div>
                    )}
                </div>
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                >
                    {CONTENT_PIECE_STATUS_LABELS[piece.status]}
                </span>
            </div>

            <p className="mb-3 line-clamp-2 text-xs text-gray-500">
                {piece.body.substring(0, 150)}
                {piece.body.length > 150 && '...'}
            </p>

            <div className="flex items-center gap-2">
                {piece.status === 'DRAFT' && (
                    <button
                        onClick={onApprove}
                        className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                    >
                        Aprovar
                    </button>
                )}
                <button
                    onClick={onEdit}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                    Editar
                </button>
                <button
                    onClick={onDelete}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                    Eliminar
                </button>
            </div>
        </div>
    );
}
