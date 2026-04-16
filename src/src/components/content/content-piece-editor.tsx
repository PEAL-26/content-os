import type { ContentPieceWithRelations, ContentSlide } from '@/types/database';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ContentPieceEditorProps {
    piece: ContentPieceWithRelations;
    onSave: (data: {
        body: string;
        hookText: string | null;
        ctaText: string | null;
        hashtags: string[];
        slides: ContentSlide[] | null;
    }) => void;
    isSaving?: boolean;
}

export function ContentPieceEditor({
    piece,
    onSave,
    isSaving = false,
}: ContentPieceEditorProps) {
    const [body, setBody] = useState(piece.body);
    const [hookText, setHookText] = useState(piece.hookText || '');
    const [ctaText, setCtaText] = useState(piece.ctaText || '');
    const [hashtagInput, setHashtagInput] = useState('');
    const [hashtags, setHashtags] = useState<string[]>(piece.hashtags || []);
    const [slides, setSlides] = useState<ContentSlide[]>(piece.slides || []);

    const [hasChanges, setHasChanges] = useState(false);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef<string>('');

    useEffect(() => {
        setBody(piece.body);
        setHookText(piece.hookText || '');
        setCtaText(piece.ctaText || '');
        setHashtags(piece.hashtags || []);
        setSlides(piece.slides || []);
        lastSavedRef.current = JSON.stringify({
            body: piece.body,
            hookText: piece.hookText,
            ctaText: piece.ctaText,
            hashtags: piece.hashtags,
            slides: piece.slides,
        });
        setHasChanges(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- piece properties intentionally omitted to avoid infinite loops
    }, [piece.id]);

    const checkForChanges = useCallback(
        (
            newBody: string,
            newHookText: string,
            newCtaText: string,
            newHashtags: string[],
            newSlides: ContentSlide[]
        ) => {
            const current = JSON.stringify({
                body: newBody,
                hookText: newHookText || null,
                ctaText: newCtaText || null,
                hashtags: newHashtags,
                slides: newSlides,
            });
            return current !== lastSavedRef.current;
        },
        []
    );

    const save = useCallback(() => {
        const data = {
            body,
            hookText: hookText || null,
            ctaText: ctaText || null,
            hashtags,
            slides: slides.length > 0 ? slides : null,
        };
        lastSavedRef.current = JSON.stringify({
            body,
            hookText: data.hookText,
            ctaText: data.ctaText,
            hashtags,
            slides: data.slides,
        });
        onSave(data);
    }, [body, hookText, ctaText, hashtags, slides, onSave]);

    const scheduleSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            save();
        }, 1500);
    }, [save]);

    const handleBodyChange = (value: string) => {
        setBody(value);
        setHasChanges(
            checkForChanges(value, hookText, ctaText, hashtags, slides)
        );
        scheduleSave();
    };

    const handleHookChange = (value: string) => {
        setHookText(value);
        setHasChanges(checkForChanges(body, value, ctaText, hashtags, slides));
        scheduleSave();
    };

    const handleCtaChange = (value: string) => {
        setCtaText(value);
        setHasChanges(checkForChanges(body, hookText, value, hashtags, slides));
        scheduleSave();
    };

    const handleAddHashtag = () => {
        const trimmed = hashtagInput.trim().replace(/^#/, '');
        if (trimmed && !hashtags.includes(trimmed)) {
            const newHashtags = [...hashtags, trimmed];
            setHashtags(newHashtags);
            setHashtagInput('');
            setHasChanges(
                checkForChanges(body, hookText, ctaText, newHashtags, slides)
            );
            scheduleSave();
        }
    };

    const handleRemoveHashtag = (tag: string) => {
        const newHashtags = hashtags.filter((h) => h !== tag);
        setHashtags(newHashtags);
        setHasChanges(
            checkForChanges(body, hookText, ctaText, newHashtags, slides)
        );
        scheduleSave();
    };

    const handleUpdateSlide = (
        index: number,
        updates: Partial<ContentSlide>
    ) => {
        const newSlides = slides.map((s, i) =>
            i === index ? { ...s, ...updates } : s
        );
        setSlides(newSlides);
        setHasChanges(
            checkForChanges(body, hookText, ctaText, hashtags, newSlides)
        );
        scheduleSave();
    };

    const handleAddSlide = () => {
        const newSlides = [
            ...slides,
            { order: slides.length + 1, title: '', body: '' },
        ];
        setSlides(newSlides);
        setHasChanges(
            checkForChanges(body, hookText, ctaText, hashtags, newSlides)
        );
        scheduleSave();
    };

    const handleRemoveSlide = (index: number) => {
        const newSlides = slides
            .filter((_, i) => i !== index)
            .map((s, i) => ({ ...s, order: i + 1 }));
        setSlides(newSlides);
        setHasChanges(
            checkForChanges(body, hookText, ctaText, hashtags, newSlides)
        );
        scheduleSave();
    };

    const handleMoveSlideUp = (index: number) => {
        if (index === 0) return;
        const newSlides = [...slides];
        [newSlides[index - 1], newSlides[index]] = [
            newSlides[index],
            newSlides[index - 1],
        ];
        const reorderedSlides = newSlides.map((s, i) => ({
            ...s,
            order: i + 1,
        }));
        setSlides(reorderedSlides);
        setHasChanges(
            checkForChanges(body, hookText, ctaText, hashtags, reorderedSlides)
        );
        scheduleSave();
    };

    const handleMoveSlideDown = (index: number) => {
        if (index === slides.length - 1) return;
        const newSlides = [...slides];
        [newSlides[index], newSlides[index + 1]] = [
            newSlides[index + 1],
            newSlides[index],
        ];
        const reorderedSlides = newSlides.map((s, i) => ({
            ...s,
            order: i + 1,
        }));
        setSlides(reorderedSlides);
        setHasChanges(
            checkForChanges(body, hookText, ctaText, hashtags, reorderedSlides)
        );
        scheduleSave();
    };

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    const isSavingAny = isSaving;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {hasChanges && !isSavingAny && (
                        <span className="text-xs text-amber-600">
                            Alterações não guardadas
                        </span>
                    )}
                    {isSavingAny && (
                        <span className="text-xs text-gray-500">
                            A guardar...
                        </span>
                    )}
                    {!hasChanges && !isSavingAny && (
                        <span className="text-xs text-green-600">Guardado</span>
                    )}
                </div>
            </div>

            {piece.format === 'CAROUSEL' && (
                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                        Slides
                    </label>
                    <div className="space-y-3">
                        {slides.map((slide, index) => (
                            <div
                                key={index}
                                className="rounded-md border border-gray-200 bg-white p-3"
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500">
                                        Slide {index + 1}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleMoveSlideUp(index)
                                            }
                                            disabled={index === 0}
                                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                                            title="Mover para cima"
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
                                                    d="M5 15l7-7 7 7"
                                                />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleMoveSlideDown(index)
                                            }
                                            disabled={
                                                index === slides.length - 1
                                            }
                                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                                            title="Mover para baixo"
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
                                                    d="M19 9l-7 7-7-7"
                                                />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveSlide(index)
                                            }
                                            className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                                            title="Remover slide"
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
                                        </button>
                                    </div>
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
                piece.format === 'THREAD') && (
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Body
                    </label>
                    <textarea
                        value={body}
                        onChange={(e) => handleBodyChange(e.target.value)}
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
                            onChange={(e) => handleHookChange(e.target.value)}
                            placeholder="Texto que aparece nos primeiros segundos..."
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Body
                        </label>
                        <textarea
                            value={body}
                            onChange={(e) => handleBodyChange(e.target.value)}
                            placeholder="Corpo do roteiro..."
                            rows={4}
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
                            onChange={(e) => handleCtaChange(e.target.value)}
                            placeholder="Texto do call to action..."
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                </>
            )}

            {(piece.format === 'LINKEDIN_POST' || piece.format === 'IMAGE') && (
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
                            onChange={(e) => setHashtagInput(e.target.value)}
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
    );
}
