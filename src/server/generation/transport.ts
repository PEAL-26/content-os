import { createOpenAI } from '@ai-sdk/openai';
import { APICallError, generateText } from 'ai';
import type { GenerationTransport } from '../../src/lib/ai/provider.js';

// =============================================================================
// Transport direto (server→provider) para os jobs de geração.
// Igual à chamada de `/api/ai/generate` (`runGeneration`), mas como função
// injetável no núcleo puro (`generateWithFallback`), com timeout por job.
// =============================================================================

/**
 * Cria um transport server-side com timeout próprio (por chamada LLM).
 * Artigo: 300s · Peças/Roteiros: 180s.
 */
export function createServerTransport(timeoutMs: number): GenerationTransport {
    return async (input) => {
        const { baseUrl, apiKey, model, system, prompt, config, headers } =
            input;

        const providerHeaders: Record<string, string> = headers ?? {};

        const openai = createOpenAI({
            baseURL: baseUrl,
            apiKey,
            ...(Object.keys(providerHeaders).length > 0
                ? { headers: providerHeaders }
                : {}),
        });

        const generateOptions: Record<string, unknown> = {};
        if (config?.temperature != null) {
            generateOptions.temperature = config.temperature;
        }

        try {
            const { text } = await generateText({
                model: openai.chat(model),
                ...(system ? { system } : {}),
                prompt,
                maxOutputTokens: config?.max_tokens ?? 8000,
                ...generateOptions,
                timeout: timeoutMs,
            });

            return text;
        } catch (err) {
            // O modelo e o endpoint entram na mensagem: um "Not Found" sem isto
            // é impossível de diagnosticar (foi um modelCode com um hífen a
            // menos que custou uma sessão de investigação). Nunca a chave.
            const onde = `modelo ${model} em ${baseUrl}`;

            if (err instanceof APICallError) {
                const status = err.statusCode ?? '?';
                throw new Error(
                    `O provider respondeu ${status} (${onde})${err.message ? `: ${err.message}` : ''}`
                );
            }
            throw new Error(
                `${err instanceof Error ? err.message : String(err)} (${onde})`
            );
        }
    };
}