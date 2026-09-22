import type { AIProviderConfigOptions } from './types';
import type { AIProvider, AIProviderModel } from '@/services/ai-provider.service';
import { resolveProviderConfig } from './resolver';
import type { GenerateOptionsResult } from './resolver';
import { callLLM } from './transport';

// =============================================================================
// Transporte — todas as chamadas LLM passam pelo servidor próprio (`callLLM`),
// que resolve o CORS. A orquestração (fallback, preferido, config) mantém-se
// aqui no cliente.
// =============================================================================

/** Converte os headers de um provider (BD) numa Record para o transporte. */
export function providerHeadersToRecord(
    headers?: { key: string; value: string }[]
): Record<string, string> | undefined {
    if (!headers || headers.length === 0) return undefined;
    const record: Record<string, string> = {};
    for (const header of headers) {
        if (header.key && header.value) {
            record[header.key] = header.value;
        }
    }
    return Object.keys(record).length > 0 ? record : undefined;
}

// =============================================================================
// Store-based (fonte única de verdade — providers na BD com chaves em memória)
// =============================================================================

/**
 * Providers activos com chave disponível. As chaves estão
 * indexadas por `provider.id` (row id da BD).
 */
export function getAvailableProvidersFromStore(
    providers: AIProvider[],
    apiKeys: Record<string, string>
): AIProvider[] {
    return providers
        .filter((p) => p.isActive && apiKeys[p.id])
        .sort((a, b) => a.priority - b.priority);
}

/** Escolhe o modelo preferido (default do workspace) ou o primeiro activo. */
export function pickModel(
    provider: AIProvider,
    preferredModelCode?: string | null
): AIProviderModel {
    const models = provider.models?.filter((m) => m.isActive) ?? [];
    if (models.length === 0) {
        throw new Error(`O provider ${provider.name} não tem modelos activos.`);
    }
    if (preferredModelCode) {
        const preferred = models.find((m) => m.modelCode === preferredModelCode);
        if (preferred) return preferred;
    }
    return models[0];
}

// =============================================================================
// Aplicar configuração (modelo > provider > overrides) ao pedido
// =============================================================================

/**
 * Constrói as opções de geração a partir da config resolvida. Só inclui campos
 * efetivamente definidos (null/undefined não são enviados).
 */
export function buildGenerateOptions(
    config: AIProviderConfigOptions
): GenerateOptionsResult {
    const options: GenerateOptionsResult = {};

    if (config.temperature != null) {
        options.temperature = config.temperature;
    }
    if (config.max_tokens != null) {
        options.maxOutputTokens = config.max_tokens;
    }

    return options;
}

// =============================================================================
// Execução com fallback entre providers (um único caminho)
// =============================================================================

export interface GenerateWithFallbackOptions<T> {
    /** Providers disponíveis (já filtrados por chave). */
    providers: AIProvider[];
    /** Chaves por row id (provider.id). */
    apiKeys: Record<string, string>;
    /** Modelo preferido (default do workspace), se existir. */
    preferred?: { providerId?: string | null; modelCode?: string | null };
    /** Constrói o prompt (chamado uma vez antes do loop). */
    buildPrompt: () => string;
    /** System prompt resolvido (template/override + instruções extra), se houver. */
    buildSystem?: () => string;
    /** Interpreta a resposta; devolve null se não for utilizável. */
    parse: (text: string) => T | null;
    /** Nº máximo de tentativas por provider. Default 2. */
    maxAttempts?: number;
    /** Atraso entre tentativas. Default 2000 ms. */
    retryDelayMs?: number;
    /** maxOutputTokens a usar quando o provider/modelo não define nos configs. */
    defaultMaxTokens?: number;
}

export interface GenerateWithFallbackResult<T> {
    ok: boolean;
    data: T | null;
    providerId: string;
    providerName: string;
    modelCode: string;
    prompt: string;
    system?: string;
    error?: string;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa `generateWithFallback` percorrendo os providers por prioridade (o
 * preferido primeiro), com retries. Todas as chamadas passam pelo transporte
 * server-side (`callLLM` → `/api/ai/generate`), que resolve o CORS. Um único
 * caminho — sem branch legacy.
 */
export async function generateWithFallback<T>(
    options: GenerateWithFallbackOptions<T>
): Promise<GenerateWithFallbackResult<T>> {
    const {
        providers,
        apiKeys,
        preferred,
        buildPrompt,
        buildSystem,
        parse,
        maxAttempts = 2,
        retryDelayMs = 2000,
        defaultMaxTokens = 8000,
    } = options;

    if (providers.length === 0) {
        return {
            ok: false,
            data: null,
            providerId: '',
            providerName: '',
            modelCode: '',
            prompt: '',
            error: 'Nenhum provider de IA configurado. Configura pelo menos um provedor nas definições e adiciona a chave.',
        };
    }

    const prompt = buildPrompt();
    const system = buildSystem?.();
    let lastError = '';
    const providerFailures: Array<{ provider: string; error: string }> = [];

    // Providers ordenados: preferido primeiro, depois por prioridade.
    const orderedProviders = preferred?.providerId
        ? [
              ...providers.filter(
                  (p) =>
                      p.id === preferred.providerId ||
                      p.providerId === preferred.providerId
              ),
              ...providers.filter(
                  (p) =>
                      p.id !== preferred.providerId &&
                      p.providerId !== preferred.providerId
              ),
          ]
        : providers;

    for (const provider of orderedProviders) {
        const apiKey = apiKeys[provider.id];
        if (!apiKey) continue;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const modelRow = pickModel(provider, preferred?.modelCode);
                const providerConfig = resolveProviderConfig(
                    provider,
                    modelRow,
                    apiKey
                );
                const generateOptions = buildGenerateOptions(
                    providerConfig.config
                );

                const text = await callLLM({
                    baseUrl: providerConfig.base_url,
                    apiKey: providerConfig.api_key,
                    model: providerConfig.model,
                    system: system ?? undefined,
                    prompt,
                    config: {
                        ...providerConfig.config,
                        max_tokens:
                            generateOptions.maxOutputTokens ?? defaultMaxTokens,
                    },
                    headers: providerHeadersToRecord(provider.headers),
                });

                const parsed = parse(text);
                if (parsed) {
                    return {
                        ok: true,
                        data: parsed,
                        providerId: provider.providerId,
                        providerName: provider.name,
                        modelCode: modelRow.modelCode,
                        prompt,
                        system,
                    };
                }

                lastError = 'Não foi possível interpretar a resposta da IA';
            } catch (error) {
                const err = error as Error;
                lastError = err.message || 'Erro desconhecido';
                console.warn(`Provider ${provider.name} falhou:`, lastError);
            }

            if (attempt < maxAttempts - 1) {
                await delay(retryDelayMs);
            }
        }

        // Regista um erro por provider tentado, para o relatório final.
        providerFailures.push({ provider: provider.name, error: lastError });
    }

    return {
        ok: false,
        data: null,
        providerId: '',
        providerName: '',
        modelCode: '',
        prompt,
        system,
        error:
            providerFailures.length > 0
                ? `Todos os providers falharam. ${providerFailures
                      .map((f) => `${f.provider}: ${f.error}`)
                      .join('; ')}`
                : 'Nenhum provider disponível com chave configurada.',
    };
}