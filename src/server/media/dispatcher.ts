import { findAdapter } from './registry.js';
import { estimateCostUsd } from '../../src/lib/media/pricing.js';
import type {
    ArtifactModelMapping,
    MediaCandidate,
    MediaResolution,
} from '../../src/lib/media/resolution.js';
import type { MediaRequest, MediaResult } from './types.js';
import { MediaAdapterError } from './types.js';

// =============================================================================
// DISPATCHER de media
//
// Escolhe o adaptador e normaliza o resultado. A decisão de QUAL modelo usar é
// `resolveMediaModel` (em `src/lib/media/resolution.ts`, partilhada com a UI) e
// o preço é `estimateCostUsd` (idem, `pricing.ts`) — nunca recalculados aqui,
// para que o valor mostrado ao utilizador seja exactamente o que é cobrado.
//
// Ver a cadeia de resolução (mapeamento explícito → 1º activo por `priority` →
// nenhum) e o porquê do passo 3 em `src/lib/media/resolution.ts`.
// =============================================================================

// Reexportado para que os callers do servidor não precisem de dois imports.
export type { ArtifactModelMapping, MediaCandidate, MediaResolution };
export { resolveMediaModel, resolveAllMediaModels } from '../../src/lib/media/resolution.js';

// -----------------------------------------------------------------------------
// Estimativa de custo — mostrada ANTES de enfileirar (Decisão 27)
// -----------------------------------------------------------------------------

export interface ArtifactEstimate {
    modality: ArtifactModalityLike;
    /** Quantos artefactos vão ser gerados (slides, cenas, ou 1). */
    count: number;
    /** USD estimados, ou `null` se o preço é desconhecido. */
    totalUsd: number | null;
    /** `true` quando não há modelo: nada vai ser gerado. */
    blocked: boolean;
    reason: string | null;
}

type ArtifactModalityLike = MediaResolution['modality'];

export function estimateArtifactCost(
    modality: ArtifactModalityLike,
    count: number,
    request: MediaRequest,
    resolution: MediaResolution
): ArtifactEstimate {
    if (!resolution.candidate) {
        return {
            modality,
            count: 0,
            totalUsd: null,
            blocked: true,
            reason: resolution.reason,
        };
    }

    const adapter = findAdapter(
        resolution.candidate.providerTechnicalId,
        modality
    );

    if (!adapter) {
        return {
            modality,
            count: 0,
            totalUsd: null,
            blocked: true,
            reason: `O provider ${resolution.candidate.providerTechnicalId} não tem adaptador de ${modality} registado.`,
        };
    }

    const perItem = estimateCostUsd(adapter.estimate, request);
    return {
        modality,
        count,
        totalUsd: perItem === null ? null : perItem * count,
        blocked: false,
        reason: null,
    };
}

// -----------------------------------------------------------------------------
// Geração
// -----------------------------------------------------------------------------

export interface GenerateArtifactInput {
    modality: ArtifactModalityLike;
    request: MediaRequest;
    resolution: MediaResolution;
    signal?: AbortSignal;
}

/**
 * Gera um artefacto. Lança `MediaAdapterError` com mensagem accionável quando
 * não há modelo ou não há adaptador — o caller persiste `status: FAILED` com
 * essa mensagem e o prompt sobrevive intacto.
 */
export async function generateArtifact(input: GenerateArtifactInput): Promise<MediaResult> {
    const { modality, request, resolution, signal } = input;

    if (!resolution.candidate) {
        throw new MediaAdapterError(
            resolution.reason ?? `Nenhum modelo activo gera ${modality}.`,
            { providerId: 'desconhecido', modality }
        );
    }

    const adapter = findAdapter(resolution.candidate.providerTechnicalId, modality);
    if (!adapter) {
        throw new MediaAdapterError(
            `O provider "${resolution.candidate.providerTechnicalId}" não tem adaptador de ${modality}.`,
            { providerId: resolution.candidate.providerTechnicalId, modality }
        );
    }

    return adapter.generate(
        resolution.candidate.apiKey ?? '',
        resolution.candidate.baseUrl ?? '',
        request,
        signal
    );
}

/** Reexportado para o orchestration não precisar de dois imports. */
export { MediaAdapterError };
export { estimateCostUsd, formatCostUsd } from '../../src/lib/media/pricing.js';