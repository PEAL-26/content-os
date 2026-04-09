import type {
    Article,
    ContentFormat,
    ContentSlide,
    Product,
    Workspace,
} from '@/types/database';
import type { PillarConfig } from '@/types/pillar';
import { generateText } from 'ai';
import pLimit from 'p-limit';
import {
    buildPromptForFormat,
    parseCarouselResponse,
    parseCtaPostResponse,
    parseInstagramPostResponse,
    parseLinkedInPostResponse,
    parseShortVideoResponse,
    parseThreadResponse,
    parseVideoScriptResponse,
} from './content-prompts';
import { createProvider, getAvailableProviders } from './provider';
import type { AIProviderId } from './types';

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
}

export interface GenerateContentPiecesResult {
    success: boolean;
    pieces: GeneratedPiece[];
    errors: Array<{ format: ContentFormat; error: string }>;
}

const CONCURRENCY_LIMIT = 3;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateSinglePiece(
    format: ContentFormat,
    params: GenerateContentPiecesParams
): Promise<GeneratedPiece> {
    const providers = getAvailableProviders();

    if (providers.length === 0) {
        throw new Error('Nenhum provider de IA configurado');
    }

    const prompt = buildPromptForFormat(format, {
        article: params.article,
        workspace: params.workspace,
        product: params.product,
        pillar: params.pillar,
    });

    let lastError = '';

    for (const providerConfig of providers) {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const apiKey =
                    import.meta.env[providerConfig.apiKeyEnvVar] || '';
                if (!apiKey && providerConfig.id !== 'ollama') {
                    continue;
                }

                const provider = createProvider(providerConfig.id, apiKey);
                const model = provider.languageModel(
                    providerConfig.models.primary
                );

                const { text } = await generateText({
                    model,
                    prompt,
                    maxOutputTokens: 4000,
                });

                const piece = parseGeneratedContent(format, text);

                if (piece) {
                    return { ...piece, provider: providerConfig.id };
                }

                lastError = 'Não foi possível interpretar a resposta';
            } catch (error) {
                lastError =
                    error instanceof Error
                        ? error.message
                        : 'Erro desconhecido';
                console.warn(
                    `Provider ${providerConfig.id} failed:`,
                    lastError
                );
            }

            if (attempt < MAX_RETRIES - 1) {
                await delay(RETRY_DELAY_MS);
            }
        }
    }

    throw new Error(lastError || 'Todos os providers falharam');
}

function parseGeneratedContent(
    format: ContentFormat,
    text: string
): Omit<GeneratedPiece, 'provider'> | null {
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

            const body = `## Hook\n${parsed.hook || ''}\n\n## Corpo\n${parsed.body || ''}\n\n## CTA\n${parsed.cta || ''}`;

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
    params: GenerateContentPiecesParams
): Promise<GenerateContentPiecesResult> {
    const limit = pLimit(CONCURRENCY_LIMIT);

    const generationPromises = params.formats.map((format) =>
        limit(async () => {
            try {
                const piece = await generateSinglePiece(format, params);
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
        if (result.success) {
            pieces.push(result.piece);
        } else {
            errors.push({ format: result.format, error: result.error });
        }
    }

    return {
        success: pieces.length > 0,
        pieces,
        errors,
    };
}
