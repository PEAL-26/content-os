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
    | 'ollama';

export interface AIProviderConfig {
    id: AIProviderId;
    name: string;
    apiKeyEnvVar: string;
    apiUrlEnvVar?: string;
    models: {
        primary: string;
        fallback: string;
    };
    priority: number;
    isFree: boolean;
    description?: string;
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
      }
    | { success: false; error: string; code: AIProviderResult['code'] };

type Article = import('@/types/database').Article;
