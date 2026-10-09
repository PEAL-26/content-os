import type { ModelModality } from '../../types/database.js';

// =============================================================================
// MODALIDADES DE SAÍDA DOS MODELOS
//
// Um modelo pode produzir mais do que um tipo de dados (`gemini-2.5-flash-image`
// devolve texto E imagem), por isso `modalities` é um array. A array é a chave
// de tudo o que decide "qual modelo gera este artefacto".
//
// Três fontes, por esta ordem de precedência:
//   1. o que o utilizador marcou na UI (checkbox por modelo) — sempre ganha
//   2. `architecture.output_modalities` do OpenRouter, quando disponível
//   3. o catálogo curado abaixo, por modelCode
//
// Se nenhuma responder, fica vazio — que é um estado honesto: a UI mostra
// "sem modelo definido" e desactiva o botão, mas o prompt de media é sempre
// gerado na mesma (ver `runMediaPrompt`).
// =============================================================================

export const ARTIFACT_MODALITIES = ['image', 'audio', 'video'] as const;

export type ArtifactModality = (typeof ARTIFACT_MODALITIES)[number];

export function isArtifactModality(value: string): value is ArtifactModality {
    return (ARTIFACT_MODALITIES as readonly string[]).includes(value);
}

/**
 * Catálogo curado por `modelCode` (e por prefixo, para variantes de data).
 *
 * A chave é o código do modelo tal e qual como é enviado à API. As entradas
 * são deliberadamente conservadoras: só marcamos o que temos a certeza.
 */
export const CURATED_MODALITIES: Readonly<Record<string, ModelModality[]>> = {
    // OpenAI
    'gpt-image-1': ['image'],
    'gpt-image-1-mini': ['image'],
    'gpt-4o-image-preview': ['text', 'image'],
    'gpt-4o-mini-tts': ['audio'],
    'gpt-4o-audio-preview': ['text', 'audio'],

    // Google
    'imagen-3.0-generate-002': ['image'],
    'imagen-3.0-fast-generate-001': ['image'],
    'gemini-2.5-flash-image': ['text', 'image'],
    'veo-3.0-generate-preview': ['video'],

    // ElevenLabs
    'eleven_multilingual_v2': ['audio'],
    'eleven_turbo_v2_5': ['audio'],

    // Texto (o resto do catálogo seedado)
    'gpt-4o': ['text'],
    'gpt-4o-mini': ['text'],
    'o3-mini': ['text'],
};

/**
 * Prefixos → modalidades. Para famílias de modelos com variantes de data
 * (`claude-sonnet-4-20250514`, `gemini-2.0-flash`, `llama-3.3-70b-versatile`).
 * A primeira correspondência ganha; por isso as entradas específicas acima
 * têm de ser consultadas antes.
 */
const CURATED_PREFIXES: ReadonlyArray<readonly [string, ModelModality[]]> = [
    ['gpt-image', ['image']],
    ['dall-e', ['image']],
    ['imagen', ['image']],
    ['veo', ['video']],
    ['-tts', ['audio']],
    ['tts-', ['audio']],
    ['whisper', ['audio']],
    ['eleven', ['audio']],
    ['text-embedding', ['embedding']],
    ['embed', ['embedding']],
];

/** Modalidades do catálogo para um `modelCode`. */
export function curatedModalities(modelCode: string): ModelModality[] {
    const exact = CURATED_MODALITIES[modelCode];
    if (exact) return [...exact];

    const normalized = modelCode.toLowerCase();
    for (const [prefix, modalities] of CURATED_PREFIXES) {
        if (normalized.startsWith(prefix)) return [...modalities];
    }
    return [];
}

/**
 * Detecção a partir da resposta de `/models` de um provider.
 *
 * Só o OpenRouter expõe isto (`architecture.output_modalities`), e o nome do
 * campo pode mudar. Qualquer coisa inesperada devolve `null` em vez de rebentar
 * — o sync de modelos não pode falhar por causa de metadata opcional.
 */
export function detectModalitiesFromProviderResponse(entry: unknown): ModelModality[] | null {
    if (!entry || typeof entry !== 'object') return null;
    const architecture = (entry as Record<string, unknown>).architecture;
    if (!architecture || typeof architecture !== 'object') return null;

    const raw = (architecture as Record<string, unknown>).output_modalities;
    if (!Array.isArray(raw)) return null;

    const KNOWN: ModelModality[] = ['text', 'image', 'audio', 'video', 'embedding', 'other'];
    const found = raw
        .map((value) => String(value).trim().toLowerCase())
        .filter((value): value is ModelModality => (KNOWN as string[]).includes(value));

    return found.length > 0 ? found : null;
}

/**
 * O que o dispatcher precisa de um modelo.
 *
 * Declarado aqui para não acoplar a `types/database` (que não expõe o shape
 * do modelo de provider).
 */
export interface ResolvedModel {
    modelCode: string;
    isActive: boolean;
    modalities: ModelModality[];
}

/**
 * Resolve as modalidades de um modelo, por precedência: o que o utilizador
 * guardou, depois a detecção do provider, depois o catálogo.
 */
export function resolveModalities(input: {
    /** O que o utilizador guardou (pode vir de um `string[]` da BD ou do form). */
    saved?: readonly string[] | null;
    /** O que o provider declarou em `/models` (OpenRouter). */
    detected?: readonly string[] | null;
    modelCode: string;
}): ModelModality[] {
    const saved = normalizeModalities(input.saved ?? []);
    if (saved.length > 0) return saved;
    if (input.detected && input.detected.length > 0) {
        return normalizeModalities(input.detected);
    }
    return curatedModalities(input.modelCode);
}

/** Remove duplicados, entradas vazias e valores fora do conjunto conhecido. */
export function normalizeModalities(values: readonly unknown[]): ModelModality[] {
    const KNOWN: ModelModality[] = ['text', 'image', 'audio', 'video', 'embedding', 'other'];
    const out: ModelModality[] = [];
    for (const value of values) {
        const normalized = String(value).trim().toLowerCase();
        if ((KNOWN as string[]).includes(normalized) && !out.includes(normalized as ModelModality)) {
            out.push(normalized as ModelModality);
        }
    }
    return out;
}

/** O modelo produz esta modalidade? (Usado para filtrar o selector de artefacto.) */
export function modelProduces(
    model: ResolvedModel,
    modality: ArtifactModality
): boolean {
    return model.modalities.includes(modality);
}

/**
 * Modelos que podem gerar um artefacto, por modalidade, já por ordem de
 * preferência (a prioridade é resolvida pelo caller, que tem os providers).
 */
export function modelsForModality(
    models: readonly ResolvedModel[],
    modality: ArtifactModality
): ResolvedModel[] {
    return models.filter(
        (model) => model.isActive && model.modalities.length > 0 && modelProduces(model, modality)
    );
}