import type { Product, SocialChannel, Workspace } from '@/types/database';
import type { PillarConfig } from '@/types/pillar';

export interface AIGeneratedArticle {
    title: string;
    slug: string;
    summary: string;
    body: string;
    seoTitle: string;
    seoDescription: string;
    keywords: string[];
    readingTimeMin: number;
}

export interface GenerateArticleParams {
    topic: string;
    pillar?: PillarConfig;
    product?: Product;
    workspace: Workspace;
}

export type AIProviderId =
    | 'anthropic'
    | 'openai'
    | 'google'
    | 'opencode'
    | 'groq'
    | 'deepseek'
    | 'cerebras'
    | 'together'
    | 'openrouter'
    | 'nvidia'
    | 'ollama';

/** Opções de configuração de IA por provider/modelo (defaults). */
export interface AIProviderConfigOptions {
    temperature?: number | null;
    max_tokens?: number | null;
    /** Nível de raciocínio para modelos que o suportam (big-pickle, Nemotron…). */
    reasoning_effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | null;
}

/**
 * Configuração resolvida de um provedor de IA, pronta a usar na fábrica
 * OpenAI-compatible. Segue o padrão do projecto pealtech/system.
 */
export interface AIProviderConfig {
    /** id do modelo (ai_provider_models.id) */
    id: string;
    /** id técnico do provider ("anthropic", "openai", "custom_abc123") */
    providerId: string;
    /** nome do provider */
    name: string;
    /** código do modelo enviado à API (ai_provider_models.modelCode) */
    model: string;
    /** nome de exibição do modelo (ai_provider_models.displayName) */
    modelName: string;
    base_url: string;
    api_key: string;
    config: AIProviderConfigOptions;
}

export interface AIProviderResult {
    success: boolean;
    provider?: AIProviderId;
    error?: string;
    code?:
        | 'NO_API_KEY'
        | 'RATE_LIMIT'
        | 'TIMEOUT'
        | 'INVALID_RESPONSE'
        | 'API_ERROR'
        | 'NO_CREDITS';
}

export type GenerateArticleResult =
    | {
          success: true;
          article: AIGeneratedArticle;
          provider: AIProviderId;
          /** Prompt final completo (system + user) — portátil (aiPromptUsed). */
          prompt: string;
      }
    | { success: false; error: string; code: AIProviderResult['code'] };

export interface GeneratedVideoScript {
    title: string;
    hook: string;
    problem: string | null;
    solution: string | null;
    cta: string;
    fullScript: string | null;
    durationSec: number;
    onScreenText: string[];
    bRoll: string[];
    provider?: AIProviderId;
}

export interface GenerateVideoScriptParams {
    article: Article;
    targetChannel: SocialChannel;
    durationSec: number;
    workspace: Workspace;
}

export type GenerateVideoScriptResult =
    | {
          success: true;
          script: GeneratedVideoScript;
          provider: AIProviderId;
          prompt: string;
          /** Prompt final portátil por item (para content_generation_prompts). */
          portablePrompts?: import('@/services/ai-prompt.service').PortablePromptItem[];
      }
    | { success: false; error: string; code: AIProviderResult['code'] };

type Article = import('@/types/database').Article;
