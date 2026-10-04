import {
    CONTENT_FORMAT_ICONS,
    type ContentPieceWithRelations,
} from '@/types/database';
import { useState } from 'react';

// =============================================================================
// PRÉ-VISUALIZAÇÕES POR FORMATO
//
// Estas peças mostravam-se dentro do ContentPieceCard, onde o texto é cortado
// (line-clamp, "primeiros 3 tweets", secções de 80 caracteres) porque o card é
// pequeno. Na página de detalhe o objectivo é oposto — ver o conteúdo todo.
//
// A prop `compact` mantém os dois comportamentos:
//   compact=true  → card (corta o texto)
//   compact=false → página de detalhe (mostra tudo)
// =============================================================================

interface PreviewProps {
    compact?: boolean;
}

export function LinkedInPreview({
    body,
    hashtags,
    compact = true,
}: {
    body: string;
    hashtags: string[];
} & PreviewProps) {
    return (
        <div className="rounded-lg border border-blue-100 bg-white p-4">
            <p
                className={`text-sm whitespace-pre-wrap text-gray-800 ${
                    compact ? 'line-clamp-4' : ''
                }`}
            >
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

export function InstagramPreview({
    body,
    hashtags,
    compact = true,
}: {
    body: string;
    hashtags: string[];
} & PreviewProps) {
    return (
        <div className="rounded-lg border border-pink-100 bg-white">
            <div className="flex h-32 items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50">
                <span className="text-4xl">{CONTENT_FORMAT_ICONS.IMAGE}</span>
            </div>
            <div className="p-3">
                <p
                    className={`text-xs text-gray-800 ${
                        compact ? 'line-clamp-2' : ''
                    }`}
                >
                    {body || 'Sem caption'}
                </p>
                {hashtags.length > 0 && (
                    <p className="mt-1 text-xs text-pink-600">
                        {compact
                            ? hashtags
                                  .slice(0, 3)
                                  .map((h) => `#${h}`)
                                  .join(' ')
                            : hashtags.map((h) => `#${h}`).join(' ')}
                        {compact && hashtags.length > 3 && ' ...'}
                    </p>
                )}
            </div>
        </div>
    );
}

export function CarouselPreview({
    slides,
    slideCount,
    compact = true,
}: {
    slides: ContentPieceWithRelations['slides'];
    slideCount: number | null;
} & PreviewProps) {
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
                            <p
                                className={`mt-1 text-sm text-gray-300 ${
                                    compact ? 'line-clamp-2' : ''
                                }`}
                            >
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
                            aria-label="Slide anterior"
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
                            aria-label="Slide seguinte"
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
                        className={`h-1.5 w-1.5 rounded-full ${
                            i === currentSlide ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}

export function CTAPreview({
    body,
    ctaText,
    compact = true,
}: {
    body: string;
    ctaText: string | null;
} & PreviewProps) {
    return (
        <div className="rounded-lg border border-green-100 bg-white p-4">
            <p
                className={`mb-3 text-sm text-gray-800 ${
                    compact ? 'line-clamp-3' : 'whitespace-pre-wrap'
                }`}
            >
                {body || 'Sem conteúdo'}
            </p>
            <button
                type="button"
                className="w-full rounded-md bg-green-600 py-2 text-sm font-medium text-white"
            >
                {ctaText || 'Call to Action'}
            </button>
        </div>
    );
}

export function ShortVideoPreview({
    hookText,
    ctaText,
    compact = true,
}: {
    hookText: string | null;
    ctaText: string | null;
} & PreviewProps) {
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
            {compact && (
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
            )}
            {ctaText && (
                <p className="text-center text-xs text-purple-700">
                    {ctaText}
                </p>
            )}
        </div>
    );
}

export function ThreadPreview({
    body,
    compact = true,
}: { body: string } & PreviewProps) {
    const allTweets = body.split('\n\n').filter(Boolean);
    const tweets = compact ? allTweets.slice(0, 3) : allTweets;

    return (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
            {tweets.length > 0 ? (
                tweets.map((tweet, i) => (
                    <div key={i} className="flex gap-2">
                        <span className="shrink-0 text-xs font-medium text-gray-400">
                            {i + 1}/
                        </span>
                        <p
                            className={`text-xs text-gray-700 ${
                                compact ? 'line-clamp-2' : 'whitespace-pre-wrap'
                            }`}
                        >
                            {tweet}
                        </p>
                    </div>
                ))
            ) : (
                <p className="text-xs text-gray-400">Sem tweets</p>
            )}
            {compact && allTweets.length >= 3 && (
                <p className="text-xs text-gray-400">+ mais tweets...</p>
            )}
        </div>
    );
}

export function VideoScriptPreview({
    body,
    compact = true,
}: { body: string } & PreviewProps) {
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
                            className={`rounded px-2 py-1 whitespace-pre-wrap ${
                                isHook
                                    ? 'bg-yellow-50 text-yellow-800'
                                    : isCTA
                                      ? 'bg-green-50 text-green-800'
                                      : 'bg-gray-50 text-gray-700'
                            }`}
                        >
                            {compact && section.length > 80
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

/**
 * Desenha a peça na pré-visualização do seu formato.
 *
 * Peça só com prompt (PROMPT_READY sem conteúdo) mostra um aviso a apontar para
 * o prompt, em vez de um preview vazio sem explicação.
 */
export function PiecePreview({
    piece,
    compact = true,
}: {
    piece: ContentPieceWithRelations;
    compact?: boolean;
}) {
    const hasContent = Boolean(piece.body && piece.body.trim());
    const isPromptOnly = piece.status === 'PROMPT_READY' && !hasContent;

    if (isPromptOnly) {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-800">
                    Peça criada apenas com o prompt. Abre a peça para editar
                    o prompt ou gerar o conteúdo a partir dele.
                </p>
            </div>
        );
    }

    switch (piece.format) {
        case 'CAROUSEL':
            return (
                <CarouselPreview
                    slides={piece.slides}
                    slideCount={piece.slideCount}
                    compact={compact}
                />
            );
        case 'LINKEDIN_POST':
            return (
                <LinkedInPreview
                    body={piece.body}
                    hashtags={piece.hashtags}
                    compact={compact}
                />
            );
        case 'IMAGE':
            return (
                <InstagramPreview
                    body={piece.body}
                    hashtags={piece.hashtags}
                    compact={compact}
                />
            );
        case 'CTA_POST':
            return (
                <CTAPreview
                    body={piece.body}
                    ctaText={piece.ctaText}
                    compact={compact}
                />
            );
        case 'SHORT_VIDEO':
            return (
                <ShortVideoPreview
                    hookText={piece.hookText}
                    ctaText={piece.ctaText}
                    compact={compact}
                />
            );
        case 'THREAD':
            return <ThreadPreview body={piece.body} compact={compact} />;
        case 'VIDEO_SCRIPT':
            return <VideoScriptPreview body={piece.body} compact={compact} />;
        default:
            return (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-800">
                        {piece.body || 'Sem conteúdo'}
                    </p>
                </div>
            );
    }
}