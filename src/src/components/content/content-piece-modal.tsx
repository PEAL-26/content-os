import { Modal } from '@/components/ui/modal';
import { useChannels } from '@/hooks/use-channels';
import type { ContentPieceWithRelations, ContentSlide } from '@/types/database';
import { CHANNEL_LABELS, CONTENT_FORMAT_LABELS } from '@/types/database';
import { useEffect, useState } from 'react';

interface ContentPieceModalProps {
    isOpen: boolean;
    onClose: () => void;
    piece: ContentPieceWithRelations | null;
    onSave: (data: {
        title: string | null;
        body: string;
        hookText: string | null;
        ctaText: string | null;
        hashtags: string[];
        slides: ContentSlide[] | null;
        channelId: string | null;
    }) => Promise<void>;
    isSaving?: boolean;
}

export function ContentPieceModal({
    isOpen,
    onClose,
    piece,
    onSave,
    isSaving = false,
}: ContentPieceModalProps) {
    const { channels } = useChannels();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [hookText, setHookText] = useState('');
    const [ctaText, setCtaText] = useState('');
    const [hashtagInput, setHashtagInput] = useState('');
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [slides, setSlides] = useState<ContentSlide[]>([]);
    const [channelId, setChannelId] = useState<string | null>(null);

    useEffect(() => {
        if (piece) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTitle(piece.title || '');
            setBody(piece.body || '');
            setHookText(piece.hookText || '');
            setCtaText(piece.ctaText || '');
            setHashtags(piece.hashtags || []);
            setSlides(piece.slides || []);
            setChannelId(piece.channelId);
        }
    }, [piece]);

    useEffect(() => {
        if (!isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setTitle('');
            setBody('');
            setHookText('');
            setCtaText('');
            setHashtagInput('');
            setHashtags([]);
            setSlides([]);
            setChannelId(null);
        }
    }, [isOpen]);

    const handleAddHashtag = () => {
        const trimmed = hashtagInput.trim().replace(/^#/, '');
        if (trimmed && !hashtags.includes(trimmed)) {
            setHashtags((prev) => [...prev, trimmed]);
            setHashtagInput('');
        }
    };

    const handleRemoveHashtag = (tag: string) => {
        setHashtags((prev) => prev.filter((h) => h !== tag));
    };

    const handleAddSlide = () => {
        setSlides((prev) => [
            ...prev,
            { order: prev.length + 1, title: '', body: '' },
        ]);
    };

    const handleUpdateSlide = (
        index: number,
        updates: Partial<ContentSlide>
    ) => {
        setSlides((prev) =>
            prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
        );
    };

    const handleRemoveSlide = (index: number) => {
        setSlides((prev) =>
            prev
                .filter((_, i) => i !== index)
                .map((s, i) => ({ ...s, order: i + 1 }))
        );
    };

    const handleSave = async () => {
        await onSave({
            title: title || null,
            body,
            hookText: hookText || null,
            ctaText: ctaText || null,
            hashtags,
            slides: slides.length > 0 ? slides : null,
            channelId,
        });
    };

    if (!piece) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Editar: ${CONTENT_FORMAT_LABELS[piece.format]}`}
            size="lg"
        >
            <div className="space-y-4">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Título (interno)
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título para referência interna"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Canal
                    </label>
                    <select
                        value={channelId || ''}
                        onChange={(e) => setChannelId(e.target.value || null)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="">Selecionar canal</option>
                        {channels.map((c) => (
                            <option key={c.id} value={c.id}>
                                {CHANNEL_LABELS[c.channel]}{' '}
                                {c.handle ? `(@${c.handle})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {piece.format === 'CAROUSEL' && (
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Slides
                        </label>
                        <div className="space-y-3">
                            {slides.map((slide, index) => (
                                <div
                                    key={index}
                                    className="rounded-md border border-gray-200 p-3"
                                >
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-xs font-medium text-gray-500">
                                            Slide {slide.order}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveSlide(index)
                                            }
                                            className="text-xs text-red-600 hover:text-red-700"
                                        >
                                            Remover
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={slide.title}
                                        onChange={(e) =>
                                            handleUpdateSlide(index, {
                                                title: e.target.value,
                                            })
                                        }
                                        placeholder="Título do slide"
                                        className="mb-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                    <textarea
                                        value={slide.body}
                                        onChange={(e) =>
                                            handleUpdateSlide(index, {
                                                body: e.target.value,
                                            })
                                        }
                                        placeholder="Conteúdo do slide"
                                        rows={2}
                                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleAddSlide}
                                className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700"
                            >
                                + Adicionar slide
                            </button>
                        </div>
                    </div>
                )}

                {(piece.format === 'LINKEDIN_POST' ||
                    piece.format === 'IMAGE' ||
                    piece.format === 'CTA_POST' ||
                    piece.format === 'SHORT_VIDEO' ||
                    piece.format === 'THREAD') && (
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Body
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Conteúdo da peça..."
                            rows={6}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                )}

                {(piece.format === 'SHORT_VIDEO' ||
                    piece.format === 'VIDEO_SCRIPT') && (
                    <>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Hook (texto de abertura)
                            </label>
                            <input
                                type="text"
                                value={hookText}
                                onChange={(e) => setHookText(e.target.value)}
                                placeholder="Texto que aparece nos primeiros segundos..."
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                CTA (Call to Action)
                            </label>
                            <input
                                type="text"
                                value={ctaText}
                                onChange={(e) => setCtaText(e.target.value)}
                                placeholder="Texto do call to action..."
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </>
                )}

                {(piece.format === 'LINKEDIN_POST' ||
                    piece.format === 'IMAGE') && (
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Hashtags
                        </label>
                        <div className="mb-2 flex flex-wrap gap-2">
                            {hashtags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                                >
                                    #{tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveHashtag(tag)}
                                        className="ml-0.5 text-gray-500 hover:text-gray-700"
                                    >
                                        <svg
                                            className="h-3 w-3"
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
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={hashtagInput}
                                onChange={(e) =>
                                    setHashtagInput(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddHashtag();
                                    }
                                }}
                                placeholder="Adicionar hashtag e pressionar Enter"
                                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleAddHashtag}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button
                    onClick={onClose}
                    disabled={isSaving}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving || !body.trim()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isSaving ? 'A guardar...' : 'Guardar'}
                </button>
            </div>
        </Modal>
    );
}
