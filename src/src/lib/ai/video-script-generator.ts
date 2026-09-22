import {
    buildContext,
    buildSingleItemPortablePrompt,
    buildVideoScriptSystemPrompt,
    parseVideoScriptResponse,
    type ParsedVideoScript,
} from './content-prompts';
import {
    generateWithFallback,
    getAvailableProvidersFromStore,
} from './provider';
import type {
    AIProviderId,
    GenerateVideoScriptParams,
    GenerateVideoScriptResult,
    GeneratedVideoScript,
} from './types';
import type { AIProvider } from '@/services/ai-provider.service';
import type { PortablePromptItem } from '@/services/ai-prompt.service';
import { resolveSystemPrompt } from '@/services/ai-prompt.service';

/**
 * Gera um roteiro de vídeo usando os providers da conta (BD), por prioridade,
 * com retry e fallback — todas as chamadas passam pelo servidor próprio
 * (`callLLM` → /api/ai/generate), que resolve o CORS.
 */
export async function generateVideoScript(
    params: GenerateVideoScriptParams,
    storeProviders?: AIProvider[],
    storeApiKeys?: Record<string, string>,
    preferred?: { providerId?: string | null; modelCode?: string | null },
    additionalInstructions?: string
): Promise<GenerateVideoScriptResult> {
    const { article, workspace, durationSec } = params;

    // System prompt: override workspace > user > default (VIDEO_SCRIPT), com
    // instruções adicionais por geração.
    const systemPrompt = await resolveSystemPrompt({
        workspaceId: workspace.id,
        contentType: 'VIDEO_SCRIPT',
        buildDefault: () =>
            buildVideoScriptSystemPrompt({ workspace, durationSec }),
    });
    const fullSystem = additionalInstructions?.trim()
        ? `${systemPrompt}\n\n## Instruções Adicionais\n${additionalInstructions.trim()}`
        : systemPrompt;

    const result = await generateWithFallback<GeneratedVideoScript>({
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
                durationSec,
            }),
        parse: (text) => {
            const parsed = parseVideoScriptResponse(text);
            if (!parsed) return null;
            const script = convertParsedToScript(parsed, durationSec);
            if (script.title && script.hook && script.cta) return script;
            return null;
        },
        defaultMaxTokens: 4000,
    });

    if (!result.ok || !result.data) {
        return {
            success: false,
            error:
                result.error ??
                'Não foi possível gerar o roteiro. Tenta novamente.',
            code: 'API_ERROR',
        };
    }

    const promptParams = { article, workspace, durationSec };
    const portablePrompts: PortablePromptItem[] = [
        {
            itemKey: 'main',
            prompt: buildSingleItemPortablePrompt(
                'VIDEO_SCRIPT',
                promptParams,
                result.data.title,
                result.data.fullScript || result.data.solution || '',
                fullSystem
            ),
        },
    ];

    return {
        success: true,
        script: { ...result.data, provider: result.providerId as AIProviderId },
        provider: result.providerId as AIProviderId,
        prompt: result.prompt,
        portablePrompts,
    };
}

function convertParsedToScript(
    parsed: ParsedVideoScript,
    requestedDuration: number
): GeneratedVideoScript {
    return {
        title: parsed.title || 'Sem título',
        hook: parsed.hook || '',
        problem: parsed.problem,
        solution: parsed.solution,
        cta: parsed.cta || '',
        fullScript: parsed.fullScript,
        durationSec: parsed.durationSec || requestedDuration,
        onScreenText: parsed.onScreenText,
        bRoll: parsed.bRoll,
    };
}

export function calculateReadingTime(script: string, wordsPerMinute = 150): number {
    const wordCount = script.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
}

export function calculateDurationFromScript(
    script: string,
    wordsPerMinute = 150
): number {
    const wordCount = script.trim().split(/\s+/).length;
    return Math.round((wordCount / wordsPerMinute) * 60);
}

export function isDurationExceeded(
    script: string,
    targetDurationSec: number,
    wordsPerMinute = 150
): boolean {
    const actualDuration = calculateDurationFromScript(script, wordsPerMinute);
    return actualDuration > targetDurationSec;
}