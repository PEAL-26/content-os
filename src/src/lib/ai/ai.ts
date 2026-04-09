import { generateText } from 'ai';
import { buildArticlePrompt, parseArticleResponse } from './prompts';
import {
    createProvider,
    getAvailableProviders,
    getProviderById,
} from './provider';
import type {
    AIProviderId,
    GenerateArticleParams,
    GenerateArticleResult,
} from './types';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateArticle(
    params: GenerateArticleParams
): Promise<GenerateArticleResult> {
    const providers = getAvailableProviders();

    if (providers.length === 0) {
        return {
            success: false,
            error: 'Nenhum provider de IA configurado. Adiciona pelo menos uma API key no ficheiro .env.',
            code: 'NO_API_KEY',
        };
    }

    const prompt = buildArticlePrompt(params);

    let lastError = '';

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        for (const providerConfig of providers) {
            try {
                const result = await tryProvider(providerConfig.id, prompt);

                if (result.success) {
                    return {
                        success: true,
                        article: result.article,
                        provider: providerConfig.id,
                        prompt,
                    };
                }

                lastError = result.error || 'Erro desconhecido';

                if (result.code === 'NO_API_KEY') {
                    continue;
                }
            } catch (error) {
                const err = error as Error;
                lastError = err.message;
                console.warn(
                    `Provider ${providerConfig.id} falhou:`,
                    err.message
                );
            }
        }

        if (attempt < MAX_RETRIES - 1) {
            await delay(RETRY_DELAY_MS);
        }
    }

    return {
        success: false,
        error: `Todos os providers falharam. Último erro: ${lastError}`,
        code: 'API_ERROR',
    };
}

async function tryProvider(
    providerId: AIProviderId,
    prompt: string
): Promise<
    | {
          success: true;
          article: NonNullable<
              ReturnType<typeof parseArticleResponse>['article']
          >;
      }
    | { success: false; error: string; code: string }
> {
    const config = getProviderById(providerId);
    if (!config) {
        return {
            success: false,
            error: `Provider ${providerId} não encontrado ou configurado, adiciona pelo menos uma API key no ficheiro .env.`,
            code: 'API_ERROR',
        };
    }

    const apiKey = import.meta.env[config.apiKeyEnvVar] || '';
    if (!apiKey && providerId !== 'ollama') {
        return {
            success: false,
            error: 'API key não configurada',
            code: 'NO_API_KEY',
        };
    }

    const provider = createProvider(providerId, apiKey);

    const model = provider.languageModel(config.models.primary);

    const { text } = await generateText({
        model,
        prompt,
        maxOutputTokens: 8000,
    });

    const parsed = parseArticleResponse(text);

    if (!parsed.article) {
        return {
            success: false,
            error: parsed.error || 'Erro ao processar resposta',
            code: 'INVALID_RESPONSE',
        };
    }

    return { success: true, article: parsed.article };
}
