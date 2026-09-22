import {
    buildArticleSystemPrompt,
    buildArticleUserPrompt,
    parseArticleResponse,
} from './prompts';
import {
    generateWithFallback,
    getAvailableProvidersFromStore,
} from './provider';
import type {
    AIProviderId,
    GenerateArticleParams,
    GenerateArticleResult,
} from './types';
import type { AIProvider } from '@/services/ai-provider.service';
import { resolveSystemPrompt } from '@/services/ai-prompt.service';

/**
 * Gera um artigo usando os providers da conta (BD), por prioridade, com retry
 * e fallback. Todas as chamadas passam pelo transporte server-side (`callLLM`
 * → /api/ai/generate), que resolve o CORS. O system prompt é resolvido por
 * tipo de conteúdo (workspace → user → default) + instruções adicionais.
 */
export async function generateArticle(
    params: GenerateArticleParams,
    storeProviders?: AIProvider[],
    storeApiKeys?: Record<string, string>,
    preferred?: { providerId?: string | null; modelCode?: string | null },
    additionalInstructions?: string
): Promise<GenerateArticleResult> {
    // System: override workspace > user > default ('article').
    const systemPrompt = await resolveSystemPrompt({
        workspaceId: params.workspace.id,
        contentType: 'article',
        buildDefault: () => buildArticleSystemPrompt(params),
    });
    const fullSystem = additionalInstructions?.trim()
        ? `${systemPrompt}\n\n## Instruções Adicionais\n${additionalInstructions.trim()}`
        : systemPrompt;

    const result = await generateWithFallback<NonNullable<ReturnType<typeof parseArticleResponse>['article']>>({
        providers: getAvailableProvidersFromStore(
            storeProviders ?? [],
            storeApiKeys ?? {}
        ),
        apiKeys: storeApiKeys ?? {},
        preferred,
        buildSystem: () => fullSystem,
        buildPrompt: () => buildArticleUserPrompt(params),
        parse: (text) => parseArticleResponse(text).article,
        defaultMaxTokens: 8000,
    });

    if (!result.ok || !result.data) {
        return {
            success: false,
            error:
                result.error ??
                'Não foi possível gerar o artigo. Tenta novamente.',
            code: 'API_ERROR',
        };
    }

    return {
        success: true,
        article: result.data,
        provider: result.providerId as AIProviderId,
        prompt: [result.system, result.prompt].filter(Boolean).join('\n\n'),
    };
}