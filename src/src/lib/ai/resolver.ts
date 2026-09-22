import type { AIProviderConfig, AIProviderConfigOptions } from './types';
import type { AIProvider, AIProviderModel } from '@/services/ai-provider.service';

export type ReasoningEffort =
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh';

const REASONING_VALUES: readonly ReasoningEffort[] = [
    'none',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
];

export interface GenerateOptionsResult {
    temperature?: number;
    maxOutputTokens?: number;
    reasoning?: ReasoningEffort;
}

/**
 * URLs base OpenAI-compatible por providerId. Usadas quando a linha da BD não
 * define `baseUrl` (providers pré-cadastrados).
 */
export const DEFAULT_BASE_URLS: Record<string, string> = {
    anthropic: 'https://api.anthropic.com/v1/',
    openai: 'https://api.openai.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    opencode: 'https://opencode.ai/zen/v1',
    groq: 'https://api.groq.com/openai/v1',
    deepseek: 'https://api.deepseek.com/v1',
    cerebras: 'https://api.cerebras.ai/v1',
    together: 'https://api.together.xyz/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    nvidia: 'https://integrate.api.nvidia.com/v1',
    ollama: 'http://localhost:11434/v1',
};

/** Converte o JSON da BD para AIProviderConfigOptions (tolerante a null/valores inválidos). */
export function normalizeConfig(raw: unknown): AIProviderConfigOptions {
    if (!raw || typeof raw !== 'object') return {};

    const obj = raw as Record<string, unknown>;
    const config: AIProviderConfigOptions = {};

    if (
        typeof obj.temperature === 'number' &&
        Number.isFinite(obj.temperature) &&
        obj.temperature >= 0 &&
        obj.temperature <= 2
    ) {
        config.temperature = obj.temperature;
    }

    if (
        typeof obj.max_tokens === 'number' &&
        Number.isFinite(obj.max_tokens) &&
        obj.max_tokens > 0
    ) {
        config.max_tokens = Math.floor(obj.max_tokens);
    }

    if (
        typeof obj.reasoning_effort === 'string' &&
        (REASONING_VALUES as readonly string[]).includes(obj.reasoning_effort)
    ) {
        config.reasoning_effort = obj.reasoning_effort as ReasoningEffort;
    }

    return config;
}

/**
 * Resolve a configuração final de um provider + modelo, pronta para a fábrica
 * OpenAI-compatible. O `config` é o merge modelo > provider > overrides
 * (o mais específico vence). O `base_url` usa o override > `baseUrl` da BD >
 * default por providerId.
 */
export function resolveProviderConfig(
    provider: AIProvider,
    model: AIProviderModel,
    apiKey: string,
    overrides?: {
        baseUrl?: string | null;
        call?: AIProviderConfigOptions;
    }
): AIProviderConfig {
    const providerConfig = normalizeConfig(provider.config);
    const modelConfig = normalizeConfig(model.config);
    const callConfig = normalizeConfig(overrides?.call);

    const merged: AIProviderConfigOptions = {
        ...providerConfig,
        ...modelConfig,
        ...callConfig,
    };

    const base_url =
        overrides?.baseUrl ??
        provider.baseUrl ??
        DEFAULT_BASE_URLS[provider.providerId] ??
        '';

    return {
        id: model.id,
        providerId: provider.providerId,
        name: provider.name,
        model: model.modelCode,
        modelName: model.displayName,
        base_url,
        api_key: apiKey,
        config: merged,
    };
}