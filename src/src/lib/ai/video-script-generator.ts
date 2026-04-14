import { generateText } from 'ai';
import {
    buildVideoScriptPrompt,
    parseVideoScriptResponse,
    type ParsedVideoScript,
} from './content-prompts';
import { createProvider, getAvailableProviders } from './provider';
import type {
    AIProviderId,
    GenerateVideoScriptParams,
    GenerateVideoScriptResult,
    GeneratedVideoScript,
} from './types';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateVideoScript(
    params: GenerateVideoScriptParams
): Promise<GenerateVideoScriptResult> {
    const providers = getAvailableProviders();

    if (providers.length === 0) {
        return {
            success: false,
            error: 'Nenhum provider de IA configurado. Adiciona pelo menos uma API key no ficheiro .env.',
            code: 'NO_API_KEY',
        };
    }

    const prompt = buildVideoScriptPrompt({
        article: params.article,
        workspace: params.workspace,
        durationSec: params.durationSec,
    });

    let lastError = '';

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        for (const providerConfig of providers) {
            try {
                const result = await tryProvider(providerConfig.id, prompt, params.durationSec);

                if (result.success) {
                    return {
                        success: true,
                        script: result.script,
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
    prompt: string,
    durationSec: number
): Promise<
    | { success: true; script: GeneratedVideoScript }
    | { success: false; error: string; code: string }
> {
    const config = getAvailableProviders().find((p) => p.id === providerId);

    if (!config) {
        return {
            success: false,
            error: `Provider ${providerId} não encontrado ou configurado.`,
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
        maxOutputTokens: 4000,
    });

    const parsed = parseVideoScriptResponse(text);

    if (!parsed) {
        return {
            success: false,
            error: 'Não foi possível interpretar a resposta da IA',
            code: 'INVALID_RESPONSE',
        };
    }

    const script = convertParsedToScript(parsed, durationSec);

    if (!script.title || !script.hook || !script.cta) {
        return {
            success: false,
            error: 'Resposta incompleta da IA',
            code: 'INVALID_RESPONSE',
        };
    }

    return { success: true, script };
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
