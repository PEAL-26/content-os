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
    buildContext,
    buildPortablePromptsForPiece,
    buildSystemPromptForFormat,
    parseGeneratedContent,
    type ParsedGeneratedPiece,
} from './content-prompts';
import {
    generateWithFallback,
    getAvailableProvidersFromStore,
} from './provider';
import { callLLM } from './transport';
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

    const result = await generateWithFallback<ParsedGeneratedPiece>({
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
        transport: callLLM,
    });

    if (!result.ok || !result.data) {
        throw new Error(result.error ?? 'Erro ao gerar peça de conteúdo');
    }

    return {
        ...result.data,
        provider: result.providerId as AIProviderId,
        portablePrompts: buildPortablePromptsForPiece(
            format,
            {
                article: params.article,
                workspace: params.workspace,
                product: params.product,
                pillar: params.pillar,
            },
            result.data,
            fullSystem
        ),
    };
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