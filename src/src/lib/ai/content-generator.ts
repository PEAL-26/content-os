import type {
    Article,
    ContentFormat,
    ContentSlide,
    Product,
    Workspace,
} from '@/types/database';
import type { PillarConfig } from '@/types/pillar';
import pLimit from 'p-limit';
import {
    buildCarouselItemPortablePrompt,
    buildContext,
    buildSingleItemPortablePrompt,
    buildSystemPromptForFormat,
    buildThreadItemPortablePrompt,
    parseCarouselResponse,
    parseCtaPostResponse,
    parseInstagramPostResponse,
    parseLinkedInPostResponse,
    parseShortVideoResponse,
    parseThreadResponse,
    parseVideoScriptResponse,
} from './content-prompts';
import {
    generateWithFallback,
    getAvailableProvidersFromStore,
} from './provider';
import type { AIProviderId } from './types';
import type { AIProvider } from '@/services/ai-provider.service';
import type { PortablePromptItem } from '@/services/ai-prompt.service';
import { resolveSystemPrompt } from '@/services/ai-prompt.service';

export interface GenerateContentPiecesParams {
    article: Article;
    formats: ContentFormat[];
    workspace: Workspace;
    product?: Product;
    pillar?: PillarConfig;
}

export interface GeneratedPiece {
    format: ContentFormat;
    title: string | null;
    body: string;
    hookText: string | null;
    ctaText: string | null;
    hashtags: string[];
    slides: ContentSlide[] | null;
    slideCount: number | null;
    provider?: AIProviderId;
    /** Prompts finais portáteis por item (para content_generation_prompts). */
    portablePrompts?: PortablePromptItem[];
}

export interface GenerateContentPiecesResult {
    success: boolean;
    pieces: GeneratedPiece[];
    errors: Array<{ format: ContentFormat; error: string }>;
}

const CONCURRENCY_LIMIT = 3;

async function generateSinglePiece(
    format: ContentFormat,
    params: GenerateContentPiecesParams,
    storeProviders?: AIProvider[],
    storeApiKeys?: Record<string, string>,
    preferred?: { providerId?: string | null; modelCode?: string | null },
    additionalInstructions?: string
): Promise<GeneratedPiece> {
    const { article, workspace, product, pillar } = params;

    // System prompt: override workspace > user > default em código, com as
    // instruções adicionais (por geração) anexadas.
    const systemPrompt = await resolveSystemPrompt({
        workspaceId: workspace.id,
        contentType: format,
        buildDefault: () => buildSystemPromptForFormat(format, params),
    });
    const fullSystem = additionalInstructions?.trim()
        ? `${systemPrompt}\n\n## Instruções Adicionais\n${additionalInstructions.trim()}`
        : systemPrompt;

    const result = await generateWithFallback<Omit<GeneratedPiece, 'provider' | 'portablePrompts'>>({
        providers: getAvailableProvidersFromStore(
            storeProviders ?? [],
            storeApiKeys ?? {}
        ),
        apiKeys: storeApiKeys ?? {},
        preferred,
        buildSystem: () => fullSystem,
        buildPrompt: () =>
            buildContext({
                article,
                workspace,
                product,
                pillar,
            }),
        parse: (text) => parseGeneratedContent(format, text),
        maxAttempts: 2,
        defaultMaxTokens: 4000,
    });

    if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'Erro ao gerar peça de conteúdo');
    }

    return {
        ...result.data,
        provider: result.providerId as AIProviderId,
        portablePrompts: buildPortablePromptsForPiece(
            format,
            params,
            result.data
        ),
    };
}

function buildPortablePromptsForPiece(
    format: ContentFormat,
    params: GenerateContentPiecesParams,
    piece: Omit<GeneratedPiece, 'provider' | 'portablePrompts'>
): PortablePromptItem[] {
    const promptParams = {
        article: params.article,
        workspace: params.workspace,
        product: params.product,
        pillar: params.pillar,
    };

    switch (format) {
        case 'CAROUSEL':
            return (piece.slides ?? []).map((slide) => ({
                itemKey: `slide-${slide.order}`,
                prompt: buildCarouselItemPortablePrompt(
                    promptParams,
                    slide,
                    slide.order - 1
                ),
            }));

        case 'THREAD': {
            const tweets = extractThreadTweets(piece.body);
            return tweets.map((tweet) => ({
                itemKey: `tweet-${tweet.order}`,
                prompt: buildThreadItemPortablePrompt(promptParams, tweet),
            }));
        }

        default:
            return [
                {
                    itemKey: 'main',
                    prompt: buildSingleItemPortablePrompt(
                        format,
                        promptParams,
                        piece.title,
                        piece.body
                    ),
                },
            ];
    }
}

/** Extrai os tweets individuais a partir do body (separados por linha em branco). */
function extractThreadTweets(body: string): Array<{ order: number; text: string }> {
    return body
        .split(/\n\s*\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, i) => ({ order: i + 1, text }));
}

function parseGeneratedContent(
    format: ContentFormat,
    text: string
): Omit<GeneratedPiece, 'provider' | 'portablePrompts'> | null {
    switch (format) {
        case 'CAROUSEL': {
            const parsed = parseCarouselResponse(text);
            if (!parsed) return null;

            const slides = parsed.slides || [];
            const body = slides
                .map((s) => `## ${s.title}\n${s.body}`)
                .join('\n\n');

            return {
                format,
                title: parsed.title,
                body,
                slides,
                slideCount: slides.length,
                hookText: slides[0]?.title || null,
                ctaText: slides[slides.length - 1]?.body || null,
                hashtags: [],
            };
        }

        case 'LINKEDIN_POST': {
            const parsed = parseLinkedInPostResponse(text);
            if (!parsed) return null;

            return {
                format,
                title: parsed.title,
                body: parsed.body,
                hashtags: parsed.hashtags,
                hookText: parsed.body.split('\n')[0] || null,
                ctaText: null,
                slides: null,
                slideCount: null,
            };
        }

        case 'IMAGE': {
            const parsed = parseInstagramPostResponse(text);
            if (!parsed) return null;

            return {
                format,
                title: parsed.title,
                body: parsed.body,
                hashtags: parsed.hashtags,
                hookText: parsed.body.split('\n')[0] || null,
                ctaText: null,
                slides: null,
                slideCount: null,
            };
        }

        case 'SHORT_VIDEO': {
            const parsed = parseShortVideoResponse(text);
            if (!parsed) return null;

            return {
                format,
                title: parsed.title,
                body: `Hook: ${parsed.hookText || ''}\n\nCTA: ${parsed.ctaText || ''}`,
                hookText: parsed.hookText,
                ctaText: parsed.ctaText,
                hashtags: [],
                slides: null,
                slideCount: null,
            };
        }

        case 'CTA_POST': {
            const parsed = parseCtaPostResponse(text);
            if (!parsed) return null;

            return {
                format,
                title: parsed.title,
                body: parsed.body,
                ctaText: parsed.ctaText,
                hashtags: [],
                hookText: parsed.body.split('\n')[0] || null,
                slides: null,
                slideCount: null,
            };
        }

        case 'THREAD': {
            const parsed = parseThreadResponse(text);
            if (!parsed) return null;

            const tweets = parsed.tweets || [];
            const body = tweets.map((t) => t.text).join('\n\n');

            return {
                format,
                title: parsed.title,
                body,
                hashtags: [],
                hookText: tweets[0]?.text || null,
                ctaText: tweets[tweets.length - 1]?.text || null,
                slides: null,
                slideCount: null,
            };
        }

        case 'VIDEO_SCRIPT': {
            const parsed = parseVideoScriptResponse(text);
            if (!parsed) return null;

            const body = `## Hook\n${parsed.hook || ''}\n\n## Problema\n${parsed.problem || ''}\n\n## Solução\n${parsed.solution || ''}\n\n## CTA\n${parsed.cta || ''}`;

            return {
                format,
                title: parsed.title,
                body,
                hookText: parsed.hook,
                ctaText: parsed.cta,
                hashtags: [],
                slides: null,
                slideCount: null,
            };
        }

        default:
            return null;
    }
}

export async function generateContentPieces(
    params: GenerateContentPiecesParams,
    storeProviders?: AIProvider[],
    storeApiKeys?: Record<string, string>,
    preferred?: { providerId?: string | null; modelCode?: string | null },
    additionalInstructions?: string
): Promise<GenerateContentPiecesResult> {
    const limit = pLimit(CONCURRENCY_LIMIT);

    const generationPromises = params.formats.map((format) =>
        limit(async () => {
            try {
                const piece = await generateSinglePiece(
                    format,
                    params,
                    storeProviders,
                    storeApiKeys,
                    preferred,
                    additionalInstructions
                );
                return { success: true, format, piece };
            } catch (error) {
                return {
                    success: false,
                    format,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Erro desconhecido',
                };
            }
        })
    );

    const results = await Promise.all(generationPromises);

    const pieces: GeneratedPiece[] = [];
    const errors: Array<{ format: ContentFormat; error: string }> = [];

    for (const result of results) {
        if (result.success && result.piece) {
            pieces.push(result.piece);
        } else {
            errors.push({ format: result.format, error: result.error || 'Erro desconhecido' });
        }
    }

    return {
        success: pieces.length > 0,
        pieces,
        errors,
    };
}