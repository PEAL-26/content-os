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

        // `max_tokens` só é enviado quando configurado. OBRIGATÓRIO não o enviar
        // por defeito: é um tecto na RESPOSTA (completion), não na janela de
        // contexto, e não tem nada a ver com o tamanho do contexto do modelo.
        // Verificar que `undefined` não trunca: sem o campo, o provider gera até
        // `finish_reason: stop` (medido em z-ai/glm-5.3-flash e
        // nvidia/nemotron-3-ultra-550b-a55b — `finish: stop`, artigo completo).
        // O tecto de segurança é o `timeout` abaixo, não o orçamento de tokens.
        if (config?.max_tokens != null) {
            generateOptions.maxOutputTokens = config.max_tokens;
        }

        try {
            const { text, finishReason } = await generateText({
                model: openai.chat(model),
                ...(system ? { system } : {}),
                prompt,
                ...generateOptions,
                timeout: timeoutMs,
            });

            // `length` = o provider cortou a resposta porque atingiu o tecto de
            // `max_tokens`. Só acontece quando há tecto configurado, mas avisa:
            // conteúdo truncado a meio pode falhar o parse e reportar
            // "não foi possível interpretar" sem dizer porquê.
            if (finishReason === 'length') {
                console.warn(
                    `[generation] ${model} truncou a resposta (finish=length, max_tokens=${config?.max_tokens}). Aumenca max_tokens ou limpa-o para usar o limite do modelo.`
                );
            }

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