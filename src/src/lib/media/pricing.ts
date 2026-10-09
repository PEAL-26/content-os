import type { ArtifactModality } from '../ai/model-modalities.js';

// =============================================================================
// PREÇOS de media — fonte única, para o servidor E para a UI.
//
// A Decisão 27 exige que o custo apareça ANTES de o utilizador gastar. Se a UI
// calculasse o preço com a sua própria tabela e o servidor cobrasse com outra,
// o valor mostrado não era o valor cobrado — que é pior do que não mostrar
// nenhum. Por isso a tabela vive aqui e cada adaptador referencia-a
// (`estimate: MODALITY_PRICES.openai.image`) em vez de escrever o número.
//
// Os preços são aproximados e de ordem de grandeza, não uma fonte de verdade
// contábil: servem para o utilizador decidir, não para facturar.
// =============================================================================

export interface MediaEstimate {
    /** Por imagem. */
    perImageUsd?: number;
    /** Por segundo de vídeo. */
    perSecondUsd?: number;
    /** Por 1M caracteres (TTS). */
    perMillionCharsUsd?: number;
}

/**
 * Preço por `(provider técnico, modalidade)`.
 *
 * A chave é o `ai_providers.providerId` — o mesmo que os adaptadores usam. Um
 * provider sem entrada aqui é como se não tivesse adaptador: a UI mostra
 * "sem adaptador" em vez de inventar um preço.
 */
export const MODALITY_PRICES: Readonly<
    Record<string, Readonly<Partial<Record<ArtifactModality, MediaEstimate>>>>
> = {
    openai: {
        image: { perImageUsd: 0.04 },
        audio: { perMillionCharsUsd: 15 },
    },
    google: {
        image: { perImageUsd: 0.03 },
        video: { perSecondUsd: 0.75 },
    },
    elevenlabs: {
        audio: { perMillionCharsUsd: 0.3 },
    },
};

/** O que a estimativa precisa de saber do pedido. */
export interface CostableRequest {
    prompt: string;
    /** Para áudio: o que deve ser dito, quando o prompt só descreve a locução. */
    text?: string | null;
    /** Vídeo: duração alvo em segundos. */
    durationSec?: number | null;
}

/**
 * Peso do custo de uma estimativa.
 *
 * `null` quando não sabemos o preço — o que é melhor do que inventar um número,
 * porque vídeo pode custar $22 por peça.
 */
export function estimateCostUsd(
    estimate: MediaEstimate | null | undefined,
    request: CostableRequest
): number | null {
    if (!estimate) return null;
    if (estimate.perImageUsd !== undefined) return estimate.perImageUsd;
    if (estimate.perSecondUsd !== undefined) {
        return estimate.perSecondUsd * (request.durationSec ?? 30);
    }
    if (estimate.perMillionCharsUsd !== undefined) {
        const chars = (request.prompt?.length ?? 0) + (request.text?.length ?? 0);
        return (estimate.perMillionCharsUsd * chars) / 1_000_000;
    }
    return null;
}

/** Formata para a confirmação: "$0.04" / "$22.50" / null → "custo desconhecido". */
export function formatCostUsd(usd: number | null): string {
    if (usd === null) return 'custo desconhecido';
    if (usd < 0.01) return '< $0.01';
    return `$${usd.toFixed(2)}`;
}

/**
 * Preço de uma modalidade num provider, ou `null` se não houver adaptador.
 *
 * Usado pela UI para decidir se mostra um botão de gerar (com preço) ou a
 * explicação de que o prompt fica para gerar noutro sítio.
 */
export function priceFor(
    providerTechnicalId: string,
    modality: ArtifactModality
): MediaEstimate | null {
    return MODALITY_PRICES[providerTechnicalId]?.[modality] ?? null;
}

/**
 * A partir de quanto um artefacto é "caro".
 *
 * Existe para a confirmação mudar de tom: um vídeo de $22,50 precisa de um
 * aviso explícito, uma imagem de $0,04 não. O valor é o de um vídeo curto do
 * Veo — acima disso, o utilizador tem de ler o número com atenção.
 */
export const HIGH_COST_USD = 5;