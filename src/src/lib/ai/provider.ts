import { createAnthropic } from '@ai-sdk/anthropic';
import { createCerebras } from '@ai-sdk/cerebras';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import { createFallback } from 'ai-fallback';
import { createOllama } from 'ai-sdk-ollama';
import type { AIProviderConfig, AIProviderId } from './types';
import type { AIProvider } from '@/services/ai-provider.service';

// =============================================================================
// Legacy Provider Configs (env var based — fallback)
// =============================================================================

export const PROVIDER_CONFIGS: AIProviderConfig[] = [
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        apiKeyEnvVar: 'VITE_ANTHROPIC_API_KEY',
        apiUrlEnvVar: 'VITE_ANTHROPIC_API_URL',
        models: { primary: 'claude-sonnet-4-20250514', fallback: 'claude-haiku-4-20250514' },
        priority: 1,
        isFree: false,
        description: 'Modelo mais capaz, ideal para tarefas complexas',
    },
    {
        id: 'openai',
        name: 'OpenAI GPT',
        apiKeyEnvVar: 'VITE_OPENAI_API_KEY',
        apiUrlEnvVar: 'VITE_OPENAI_API_URL',
        models: { primary: 'gpt-4o', fallback: 'gpt-4o-mini' },
        priority: 2,
        isFree: false,
        description: 'Excelente equilíbrio entre custo e qualidade',
    },
    {
        id: 'google',
        name: 'Google Gemini',
        apiKeyEnvVar: 'VITE_GEMINI_API_KEY',
        apiUrlEnvVar: 'VITE_GEMINI_API_URL',
        models: { primary: 'gemini-2.0-flash', fallback: 'gemini-1.5-flash' },
        priority: 3,
        isFree: true,
        description: 'Gratuito com bons limites, muito rápido',
    },
    {
        id: 'opencode',
        name: 'OpenCode Zen',
        apiKeyEnvVar: 'VITE_OPEN_CODE_ZEN_API_KEY',
        apiUrlEnvVar: 'VITE_OPEN_CODE_ZEN_API_URL',
        models: { primary: 'big-pickle', fallback: 'nemotron-3-super-free' },
        priority: 4,
        isFree: true,
        description: '1M tokens gratuito',
    },
    {
        id: 'groq',
        name: 'Groq',
        apiKeyEnvVar: 'VITE_GROQ_API_KEY',
        apiUrlEnvVar: 'VITE_GROQ_API_URL',
        models: { primary: 'llama-3.3-70b-versatile', fallback: 'llama-3.1-8b-instant' },
        priority: 5,
        isFree: true,
        description: 'Mais rápido, 30 RPM gratuito',
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        apiKeyEnvVar: 'VITE_DEEPSEEK_API_KEY',
        apiUrlEnvVar: 'VITE_DEEPSEEK_API_URL',
        models: { primary: 'deepseek-chat', fallback: 'deepseek-reasoner' },
        priority: 6,
        isFree: false,
        description: 'Muito barato, bom para tarefas simples',
    },
    {
        id: 'cerebras',
        name: 'Cerebras',
        apiKeyEnvVar: 'VITE_CEREBRAS_API_KEY',
        apiUrlEnvVar: 'VITE_CEREBRAS_API_URL',
        models: { primary: 'llama3.3-70b', fallback: 'qwen-3-32b' },
        priority: 7,
        isFree: true,
        description: '1M tokens gratuitos por mês',
    },
    {
        id: 'together',
        name: 'Together AI',
        apiKeyEnvVar: 'VITE_TOGETHER_API_KEY',
        apiUrlEnvVar: 'VITE_TOGETHER_API_URL',
        models: { primary: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', fallback: 'mistralai/Mixtral-8x22B-Instruct-v0.1' },
        priority: 8,
        isFree: true,
        description: 'Bom tier gratuito, vários modelos open source',
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        apiKeyEnvVar: 'VITE_OPENROUTER_API_KEY',
        apiUrlEnvVar: 'VITE_OPENROUTER_API_URL',
        models: { primary: 'anthropic/claude-3.5-haiku', fallback: 'google/gemini-2.0-flash' },
        priority: 9,
        isFree: false,
        description: 'Unified API para 300+ modelos',
    },
    {
        id: 'nvidia',
        name: 'NVIDIA Inkling',
        apiKeyEnvVar: 'VITE_NVIDIA_API_KEY',
        apiUrlEnvVar: 'VITE_NVIDIA_API_URL',
        models: {
            primary: 'thinkingmachines/inkling',
            fallback: 'thinkingmachines/inkling',
        },
        priority: 11,
        isFree: true,
        description: 'Thinking Machines Lab — Inkling via NVIDIA API (self-hosted)',
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        apiKeyEnvVar: 'VITE_OLLAMA_API_KEY',
        apiUrlEnvVar: 'VITE_OLLAMA_API_URL',
        models: { primary: 'gemma3:4b', fallback: 'mistral' },
        priority: 12,
        isFree: true,
        description: 'Modelos locais no teu computador',
    },
];

// =============================================================================
// Legacy Functions (env var based — backward compatible)
// =============================================================================

export function getAvailableProviders(): AIProviderConfig[] {
    return PROVIDER_CONFIGS.filter((config) => {
        const apiKey = import.meta.env[config.apiKeyEnvVar] || '';
        return apiKey && apiKey.trim().length > 0;
    }).sort((a, b) => a.priority - b.priority);
}

export function getProviderById(id: AIProviderId): AIProviderConfig | undefined {
    return PROVIDER_CONFIGS.find((p) => p.id === id);
}

export function createProvider(id: AIProviderId, apiKey?: string, apiUrl?: string) {
    const config = getProviderById(id);
    if (!config) {
        throw new Error(`Provider ${id} não encontrado ou configurado.`);
    }

    const key = apiKey || import.meta.env[config.apiKeyEnvVar];
    const url = apiUrl || import.meta.env[config.apiUrlEnvVar || ''] || '';

    return createProviderInstance(id, key, url);
}

function createProviderInstance(id: string, apiKey: string, baseUrl?: string, headers?: Record<string, string>) {
    switch (id) {
        case 'anthropic':
            return createAnthropic({ apiKey });
        case 'openai':
            return createOpenAI({ apiKey });
        case 'google':
            return createGoogleGenerativeAI({ apiKey });
        case 'opencode':
            return createOpenAICompatible({ apiKey, baseURL: baseUrl, name: 'OpenCode' });
        case 'groq':
            return createGroq({ apiKey });
        case 'deepseek':
            return createDeepSeek({ apiKey });
        case 'cerebras':
            return createCerebras({ apiKey });
        case 'together':
            return createTogetherAI({ apiKey });
        case 'openrouter':
            return createOpenRouter({ apiKey });
        case 'nvidia':
            return createOpenAICompatible({
                apiKey: apiKey,
                baseURL: baseUrl || 'https://integrate.api.nvidia.com/v1',
                name: 'NVIDIA-Inkling',
            });

        case 'ollama':
            return createOllama({ baseURL: baseUrl });
        default:
            // Custom provider — use OpenAI-compatible
            if (id.startsWith('custom_')) {
                return createOpenAICompatible({
                    apiKey,
                    baseURL: baseUrl || '',
                    name: id,
                    headers,
                });
            }
            throw new Error(`Provider ${id} não suportado`);
    }
}

// =============================================================================
// Store-based Functions (new system)
// =============================================================================

export function getAvailableProvidersFromStore(
    providers: AIProvider[],
    apiKeys: Record<string, string>
): AIProvider[] {
    return providers
        .filter((p) => p.isActive && apiKeys[p.providerId])
        .sort((a, b) => a.priority - b.priority);
}

export function createProviderFromStore(provider: AIProvider, apiKey: string) {
    const headers: Record<string, string> = {};
    if (provider.headers) {
        for (const h of provider.headers) {
            headers[h.key] = h.value;
        }
    }

    return createProviderInstance(
        provider.providerId,
        apiKey,
        provider.baseUrl ?? undefined,
        Object.keys(headers).length > 0 ? headers : undefined
    );
}

export function createLanguageModelFromProvider(
    provider: AIProvider,
    apiKey: string,
    modelCode: string
): LanguageModel {
    const instance = createProviderFromStore(provider, apiKey);
    return instance.languageModel(modelCode);
}

export function createAvailableModelsFromStore(
    providers: AIProvider[],
    apiKeys: Record<string, string>
): LanguageModel[] {
    const available = getAvailableProvidersFromStore(providers, apiKeys);

    return available.map((provider) => {
        const key = apiKeys[provider.providerId];
        const firstModel = provider.models?.[0];
        if (!firstModel) return null;

        try {
            return createLanguageModelFromProvider(provider, key, firstModel.modelCode);
        } catch (error) {
            console.warn(`Failed to create model for ${provider.providerId}:`, error);
            return null;
        }
    }).filter((m): m is LanguageModel => m !== null);
}

export function createFallbackModelFromStore(
    providers: AIProvider[],
    apiKeys: Record<string, string>
): LanguageModel | null {
    const models = createAvailableModelsFromStore(providers, apiKeys);

    if (models.length === 0) return null;
    if (models.length === 1) return models[0];

    return createFallback({
        models: models as Parameters<typeof createFallback>[0]['models'],
        onError: (error, modelId) => {
            console.warn(`Model ${modelId} failed:`, error);
        },
    }) as unknown as LanguageModel;
}

// =============================================================================
// Error Messages
// =============================================================================

export function getErrorMessage(
    status: number,
    errorType?: string,
    provider?: string
): { message: string; code: string } {
    if (status === 401 || status === 403) {
        return {
            message: `Chave API inválida ou sem permissões para ${provider || 'o provider'}.`,
            code: 'NO_API_KEY',
        };
    }

    if (status === 402 || status === 429) {
        return {
            message: `Sem créditos disponíveis em ${provider || 'o provider'}. A tentar outro provider...`,
            code: 'NO_CREDITS',
        };
    }

    if (status === 500 || status === 502 || status === 503) {
        return {
            message: `O servidor de ${provider || 'o provider'} está com problemas. A tentar outro provider...`,
            code: 'API_ERROR',
        };
    }

    if (errorType?.includes('timeout') || status === 408) {
        return {
            message: 'O servidor demorou demasiado a responder. A tentar outro provider...',
            code: 'TIMEOUT',
        };
    }

    return {
        message: 'Ocorreu um erro inesperado. A tentar outro provider...',
        code: 'API_ERROR',
    };
}

// =============================================================================
// Legacy createAvailableModels / createFallbackModel (backward compatible)
// =============================================================================

export function createAvailableModels(): LanguageModel[] {
    const providers = getAvailableProviders();

    return providers.map((config) => {
        const apiKey = import.meta.env[config.apiKeyEnvVar] || '';
        const provider = createProvider(config.id, apiKey);
        return provider.languageModel(config.models.primary);
    });
}

export function createFallbackModel(): LanguageModel | null {
    const models = createAvailableModels();

    if (models.length === 0) return null;
    if (models.length === 1) return models[0];

    return createFallback({
        models: models as Parameters<typeof createFallback>[0]['models'],
        onError: (error, modelId) => {
            console.warn(`Model ${modelId} failed:`, error);
        },
    }) as unknown as LanguageModel;
}
