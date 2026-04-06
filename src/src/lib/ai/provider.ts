import { createAnthropic } from '@ai-sdk/anthropic'
import { createCerebras } from '@ai-sdk/cerebras'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'
import { createTogetherAI } from '@ai-sdk/togetherai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOllama } from 'ai-sdk-ollama'
import type { AIProviderConfig, AIProviderId } from './types'

export const PROVIDER_CONFIGS: AIProviderConfig[] = [
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        apiKeyEnvVar: 'VITE_ANTHROPIC_API_KEY',
        apiUrlEnvVar: 'VITE_ANTHROPIC_API_URL',
        models: {
            primary: 'claude-sonnet-4-20250514',
            fallback: 'claude-haiku-4-20250514',
        },
        priority: 1,
        isFree: false,
        description: 'Modelo mais capaz, ideal para tarefas complexas',
    },
    {
        id: 'openai',
        name: 'OpenAI GPT',
        apiKeyEnvVar: 'VITE_OPENAI_API_KEY',
        apiUrlEnvVar: 'VITE_OPENAI_API_URL',
        models: {
            primary: 'gpt-4o',
            fallback: 'gpt-4o-mini',
        },
        priority: 2,
        isFree: false,
        description: 'Excelente equilíbrio entre custo e qualidade',
    },
    {
        id: 'google',
        name: 'Google Gemini',
        apiKeyEnvVar: 'VITE_GEMINI_API_KEY',
        apiUrlEnvVar: 'VITE_GEMINI_API_URL',
        models: {
            primary: 'gemini-2.0-flash',
            fallback: 'gemini-1.5-flash',
        },
        priority: 3,
        isFree: true,
        description: 'Gratuito com bons limites, muito rápido',
    },
    {
        id: 'groq',
        name: 'Groq',
        apiKeyEnvVar: 'VITE_GROQ_API_KEY',
        apiUrlEnvVar: 'VITE_GROQ_API_URL',
        models: {
            primary: 'llama-3.3-70b-versatile',
            fallback: 'llama-3.1-8b-instant',
        },
        priority: 4,
        isFree: true,
        description: 'Mais rápido, 30 RPM gratuito',
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        apiKeyEnvVar: 'VITE_DEEPSEEK_API_KEY',
        apiUrlEnvVar: 'VITE_DEEPSEEK_API_URL',
        models: {
            primary: 'deepseek-chat',
            fallback: 'deepseek-reasoner',
        },
        priority: 5,
        isFree: false,
        description: 'Muito barato, bom para tarefas simples',
    },
    {
        id: 'cerebras',
        name: 'Cerebras',
        apiKeyEnvVar: 'VITE_CEREBRAS_API_KEY',
        apiUrlEnvVar: 'VITE_CEREBRAS_API_URL',
        models: {
            primary: 'llama3.3-70b',
            fallback: 'qwen-3-32b',
        },
        priority: 6,
        isFree: true,
        description: '1M tokens gratuitos por mês',
    },
    {
        id: 'together',
        name: 'Together AI',
        apiKeyEnvVar: 'VITE_TOGETHER_API_KEY',
        apiUrlEnvVar: 'VITE_TOGETHER_API_URL',
        models: {
            primary: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
            fallback: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
        },
        priority: 7,
        isFree: true,
        description: 'Bom tier gratuito, vários modelos open source',
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        apiKeyEnvVar: 'VITE_OPENROUTER_API_KEY',
        apiUrlEnvVar: 'VITE_OPENROUTER_API_URL',
        models: {
            primary: 'anthropic/claude-3.5-haiku',
            fallback: 'google/gemini-2.0-flash',
        },
        priority: 8,
        isFree: false,
        description: 'Unified API para 300+ modelos',
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        apiKeyEnvVar: 'VITE_OLLAMA_API_KEY',
        apiUrlEnvVar: 'VITE_OLLAMA_API_URL',
        models: {
            primary: 'gemma3:4b',//'llama3.3',
            fallback: 'mistral',
        },
        priority: 9,
        isFree: true,
        description: 'Modelos locais no teu computador',
    },
]

export function getAvailableProviders(): AIProviderConfig[] {
    return PROVIDER_CONFIGS.filter((config) => {
        const apiKey = import.meta.env[config.apiKeyEnvVar] || ''
        return apiKey && apiKey.trim().length > 0
    }).sort((a, b) => a.priority - b.priority)
}

export function getProviderById(
    id: AIProviderId
): AIProviderConfig | undefined {
    const providers = getAvailableProviders()
    return providers.find((p) => p.id === id)
}

export function createProvider(
    id: AIProviderId,
    apiKey?: string,
    apiUrl?: string
) {
    const config = getProviderById(id)
    if (!config) {
        throw new Error(
            `Provider ${id} não encontrado ou configurado, adiciona pelo menos uma API key no ficheiro .env.`
        )
    }

    const key = apiKey || import.meta.env[config.apiKeyEnvVar]
    const url = apiUrl || import.meta.env[config.apiUrlEnvVar || ''] || ''

    switch (id) {
        case 'anthropic':
            return createAnthropic({ apiKey: key })

        case 'openai':
            return createOpenAI({ apiKey: key })

        case 'google':
            return createGoogleGenerativeAI({ apiKey: key })

        case 'groq':
            return createGroq({ apiKey: key })

        case 'deepseek':
            return createDeepSeek({ apiKey: key })

        case 'cerebras':
            return createCerebras({ apiKey: key })

        case 'together':
            return createTogetherAI({ apiKey: key })

        case 'openrouter':
            return createOpenRouter({ apiKey: key })

        case 'ollama':
            return createOllama({
                baseURL: url,
            })

        default:
            throw new Error(`Provider ${id} não suportado`)
    }
}

export function getErrorMessage(
    status: number,
    errorType?: string,
    provider?: AIProviderId
): { message: string; code: string } {
    if (status === 401 || status === 403) {
        return {
            message: `Chave API inválida ou sem permissões para ${provider || 'o provider'}.`,
            code: 'NO_API_KEY',
        }
    }

    if (status === 402 || status === 429) {
        return {
            message: `Sem créditos disponíveis em ${provider || 'o provider'}. A tentar outro provider...`,
            code: 'NO_CREDITS',
        }
    }

    if (status === 500 || status === 502 || status === 503) {
        return {
            message: `O servidor de ${provider || 'o provider'} está com problemas. A tentar outro provider...`,
            code: 'API_ERROR',
        }
    }

    if (errorType?.includes('timeout') || status === 408) {
        return {
            message:
                'O servidor demorou demasiado a responder. A tentar outro provider...',
            code: 'TIMEOUT',
        }
    }

    return {
        message: 'Ocorreu um erro inesperado. A tentar outro provider...',
        code: 'API_ERROR',
    }
}
