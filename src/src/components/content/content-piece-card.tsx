import { ChannelBadge } from '@/components/channels/channel-badge';
import type { ContentPieceWithRelations } from '@/types/database';
import {
    CONTENT_FORMAT_ICONS,
    CONTENT_FORMAT_LABELS,
    CONTENT_PIECE_STATUS_COLORS,
    CONTENT_PIECE_STATUS_LABELS,
} from '@/types/database';
import { useState } from 'react';

interface ContentPieceCardProps {
    piece: ContentPieceWithRelations;
    onApprove?: () => void;
    onRegenerate?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    isApproving?: boolean;
    isRegenerating?: boolean;
}

function LinkedInPreview({
    body,
    hashtags,
}: {
    body: string;
    hashtags: string[];
}) {
    return (
        <div className="rounded-lg border border-blue-100 bg-white p-4">
            <p className="line-clamp-4 text-sm whitespace-pre-wrap text-gray-800">
                {body || 'Sem conteúdo'}
            </p>
            {hashtags.length > 0 && (
                <p className="mt-2 text-xs text-blue-600">
                    {hashtags.map((h) => `#${h}`).join(' ')}
                </p>
            )}
        </div>
    );
}

function InstagramPreview({
    body,
    hashtags,
}: {
    body: string;
    hashtags: string[];
}) {
    return (
        <div className="rounded-lg border border-pink-100 bg-white">
            <div className="flex h-32 items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
                <span className="text-4xl">{CONTENT_FORMAT_ICONS.IMAGE}</span>
            </div>
            <div className="p-3">
                <p className="line-clamp-2 text-xs text-gray-800">
                    {body || 'Sem caption'}
                </p>
                {hashtags.length > 0 && (
                    <p className="mt-1 text-xs text-pink-600">
                        {hashtags
                            .slice(0, 3)
                            .map((h) => `#${h}`)
                            .join(' ')}
                        {hashtags.length > 3 && ' ...'}
                    </p>
                )}
            </div>
        </div>
    );
}

function CarouselPreview({
    slides,
    slideCount,
}: {
    slides: ContentPieceWithRelations['slides'];
    slideCount: number | null;
}) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const slidesArray = slides || [];
    const total = slideCount || slidesArray.length || 1;

    return (
        <div className="rounded-lg border border-gray-200 bg-white">
            <div className="relative bg-gray-900 p-4">
                <div className="flex aspect-[4/3] items-center justify-center">
                    {slidesArray.length > 0 ? (
                        <div className="w-full text-center">
                            <p className="font-medium text-white">
                                {slidesArray[currentSlide]?.title ||
                                    `Slide ${currentSlide + 1}`}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-gray-300">
                                {slidesArray[currentSlide]?.body || ''}
                            </p>
                        </div>
                    ) : (
                        <span className="text-gray-400">Sem slides</span>
                    )}
                </div>
                {slidesArray.length > 1 && (
                    <>
                        <button
                            onClick={() =>
                                setCurrentSlide((s) =>
                                    s === 0 ? total - 1 : s - 1
                                )
                            }
                            className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/20 p-1 hover:bg-white/30"
                        >
                            <svg
                                className="h-4 w-4 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={() =>
                                setCurrentSlide((s) =>
                                    s === total - 1 ? 0 : s + 1
                                )
                            }
                            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/20 p-1 hover:bg-white/30"
                        >
                            <svg
                                className="h-4 w-4 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        </button>
                    </>
                )}
            </div>
            <div className="flex items-center justify-center gap-1 p-2">
                {Array.from({ length: total }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${i === currentSlide ? 'bg-blue-600' : 'bg-gray-300'}`}
                    />
                ))}
            </div>
        </div>
    );
}

function CTAPreview({
    body,
    ctaText,
}: {
    body: string;
    ctaText: string | null;
}) {
    return (
        <div className="rounded-lg border border-green-100 bg-white p-4">
            <p className="mb-3 line-clamp-3 text-sm text-gray-800">
                {body || 'Sem conteúdo'}
            </p>
            <button className="w-full rounded-md bg-green-600 py-2 text-sm font-medium text-white">
                {ctaText || 'Call to Action'}
            </button>
        </div>
    );
}

function ShortVideoPreview({
    hookText,
    ctaText,
}: {
    hookText: string | null;
    ctaText: string | null;
}) {
    return (
        <div className="rounded-lg border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
            <div className="mb-3 rounded bg-yellow-100 px-2 py-1">
                <span className="text-xs font-medium text-yellow-800">
                    HOOK
                </span>
                <p className="mt-1 text-sm font-medium text-gray-900">
                    {hookText || 'Sem hook'}
                </p>
            </div>
            <div className="flex items-center justify-center py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600">
                    <svg
                        className="h-6 w-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
            </div>
            {ctaText && (
                <p className="text-center text-xs text-purple-700">{ctaText}</p>
            )}
        </div>
    );
}

function ThreadPreview({ body }: { body: string }) {
    const tweets = body.split('\n\n').filter(Boolean).slice(0, 3);

    return (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
            {tweets.length > 0 ? (
                tweets.map((tweet, i) => (
                    <div key={i} className="flex gap-2">
                        <span className="shrink-0 text-xs font-medium text-gray-400">
                            {i + 1}/
                        </span>
                        <p className="line-clamp-2 text-xs text-gray-700">
                            {tweet}
                        </p>
                    </div>
                ))
            ) : (
                <p className="text-xs text-gray-400">Sem tweets</p>
            )}
            {tweets.length >= 3 && (
                <p className="text-xs text-gray-400">+ mais tweets...</p>
            )}
        </div>
    );
}

function VideoScriptPreview({ body }: { body: string }) {
    const sections = body.split('\n\n').filter(Boolean);

    return (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-xs">
            {sections.length > 0 ? (
                sections.map((section, i) => {
                    const isHook =
                        section.startsWith('HOOK') ||
                        section.startsWith('Hook');
                    const isCTA =
                        section.startsWith('CTA') ||
                        section.startsWith('## CTA');
                    return (
                        <div
                            key={i}
                            className={`rounded px-2 py-1 ${isHook ? 'bg-yellow-50 text-yellow-800' : isCTA ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'}`}
                        >
                            {section.length > 80
                                ? `${section.substring(0, 80)}...`
                                : section}
                        </div>
                    );
                })
            ) : (
                <p className="text-gray-400">Sem roteiro</p>
            )}
        </div>
    );
}

export function ContentPieceCard({
    piece,
    onApprove,
    onRegenerate,
    onEdit,
    onDelete,
    isApproving = false,
    isRegenerating = false,
}: ContentPieceCardProps) {
    const statusColors = CONTENT_PIECE_STATUS_COLORS[piece.status];
    const isDraft = piece.status === 'DRAFT';

    const renderPreview = () => {
        switch (piece.format) {
            case 'CAROUSEL':
                return (
                    <CarouselPreview
                        slides={piece.slides}
                        slideCount={piece.slideCount}
                    />
                );
            case 'LINKEDIN_POST':
                return (
                    <LinkedInPreview
                        body={piece.body}
                        hashtags={piece.hashtags}
                    />
                );
            case 'IMAGE':
                return (
                    <InstagramPreview
                        body={piece.body}
                        hashtags={piece.hashtags}
                    />
                );
            case 'CTA_POST':
                return <CTAPreview body={piece.body} ctaText={piece.ctaText} />;
            case 'SHORT_VIDEO':
                return (
                    <ShortVideoPreview
                        hookText={piece.hookText}
                        ctaText={piece.ctaText}
                    />
                );
            case 'THREAD':
                return <ThreadPreview body={piece.body} />;
            case 'VIDEO_SCRIPT':
                return <VideoScriptPreview body={piece.body} />;
            default:
                return (
                    <p className="text-sm text-gray-500">
                        {piece.body.substring(0, 100)}
                    </p>
                );
        }
    };

    return (
        <div className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg">
                        {CONTENT_FORMAT_ICONS[piece.format]}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                        {CONTENT_FORMAT_LABELS[piece.format]}
                    </span>
                    {piece.channel && (
                        <ChannelBadge
                            channel={piece.channel.channel}
                            size="sm"
                        />
                    )}
                </div>
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                >
                    {CONTENT_PIECE_STATUS_LABELS[piece.status]}
                </span>
            </div>

            <div className="p-4">{renderPreview()}</div>

            {piece.article && (
                <div className="border-t border-gray-100 px-4 py-2">
                    <p className="text-xs text-gray-500">
                        Artigo: {piece.article.title}
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2">
                <div className="flex items-center gap-2">
                    {isDraft && onApprove && (
                        <button
                            onClick={onApprove}
                            disabled={isApproving}
                            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                            {isApproving ? (
                                <svg
                                    className="h-3 w-3 animate-spin"
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
                            ) : (
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
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            )}
                            Aprovar
                        </button>
                    )}
                    {onRegenerate && (
                        <button
                            onClick={onRegenerate}
                            disabled={isRegenerating}
                            className="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-white px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                        >
                            {isRegenerating ? (
                                <svg
                                    className="h-3 w-3 animate-spin"
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
                            ) : (
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
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                            )}
                            Regenerar
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Editar"
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
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                            </svg>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar"
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
