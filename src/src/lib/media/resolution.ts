import {
    ARTIFACT_MODALITIES,
    type ArtifactModality,
} from '../ai/model-modalities.js';

// =============================================================================
// RESOLUÇÃO do modelo de media — partilhada pelo servidor e pela UI.
//
// Decide COM QUE MODELO gerar cada artefacto, pela mesma cadeia de resolução do
// texto (`preferred` → workspace default → 1º activo por `priority`) mas por
// MODALIDADE, e não por tipo de conteúdo:
//
//   1. `artifactModels[modality]` do workspace, se apontar para um modelo activo
//      que produza a modalidade
//   2. senão, o 1º modelo activo que produza a modalidade, por `priority`
//   3. senão, `null` — o prompt de media é SEMPRE gerado, o artefacto não
//
// O passo 3 é o que respeita o requisito "se tiver um modelo para gerar o
// artefacto": sem modelo, o utilizador fica com o prompt portátil para gerar
// noutro sítio.
//
// Este módulo não faz I/O e não toca em segredos, por isso vive em `src/lib/`:
// o servidor usa-o para decidir o que cobra, e a UI usa-o exactamente o mesmo
// código para mostrar o que o utilizador vai pagar. Duas implementações
// divergentes dariam um preço na UI diferente do preço cobrado.
// =============================================================================

/**
 * Um modelo candidato.
 *
 * `apiKey` é opcional porque a UI trabalha com a mesma lista mas sem chaves —
 * ao browser nunca vai o segredo.
 */
export interface MediaCandidate {
    /** Row id de `ai_providers.id`. */
    providerId: string;
    /** `ai_providers.providerId` — o id técnico ("openai", "elevenlabs"). */
    providerTechnicalId: string;
    modelCode: string;
    /** `ai_provider_models.modalities`. */
    modalities: string[];
    isActive: boolean;
    /** `ai_providers.priority` — menor = primeiro. */
    priority: number;
    /** Só no servidor. */
    apiKey?: string;
    baseUrl?: string | null;
}

/** Mapa `{ image?, audio?, video? }` guardado em `workspaces.artifactModels`. */
export interface ArtifactModelMapping {
    image?: string | null;
    audio?: string | null;
    video?: string | null;
}

export interface MediaResolution {
    modality: ArtifactModality;
    candidate: MediaCandidate | null;
    /** Porquê ficou sem modelo — a UI mostra-o em vez de um erro genérico. */
    reason: string | null;
}

function produces(candidate: MediaCandidate, modality: ArtifactModality): boolean {
    return candidate.isActive && candidate.modalities.includes(modality);
}

/**
 * Resolve o modelo de uma modalidade. Ordem: mapeamento explícito do workspace
 * → primeiro activo por `priority`.
 */
export function resolveMediaModel(
    modality: ArtifactModality,
    candidates: readonly MediaCandidate[],
    mapping: ArtifactModelMapping | null
): MediaResolution {
    const usable = candidates.filter((candidate) => produces(candidate, modality));

    if (usable.length === 0) {
        return {
            modality,
            candidate: null,
            reason:
                'Nenhum modelo activo gera ' +
                modality +
                '. O prompt fica guardado para gerares noutro sítio.',
        };
    }

    const preferredCode = mapping?.[modality];
    if (preferredCode) {
        const explicit = usable.find((candidate) => candidate.modelCode === preferredCode);
        if (explicit) return { modality, candidate: explicit, reason: null };
        // Mapeamento aponta para um modelo que já não existe ou foi desactivado.
        // Degradar para automático é melhor do que falhar.
    }

    const byPriority = [...usable].sort(
        (a, b) => a.priority - b.priority || a.modelCode.localeCompare(b.modelCode)
    );

    return { modality, candidate: byPriority[0], reason: null };
}

/** Resolver para as 3 modalidades de uma vez (o painel mostra as três linhas). */
export function resolveAllMediaModels(
    candidates: readonly MediaCandidate[],
    mapping: ArtifactModelMapping | null
): Record<ArtifactModality, MediaResolution> {
    const out = {} as Record<ArtifactModality, MediaResolution>;
    for (const modality of ARTIFACT_MODALITIES) {
        out[modality] = resolveMediaModel(modality, candidates, mapping);
    }
    return out;
}