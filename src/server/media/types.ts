import type { ArtifactModality } from '../../src/lib/ai/model-modalities.js';
import type { MediaEstimate } from '../../src/lib/media/pricing.js';

// =============================================================================
// Tipos do dispatcher de media
//
// O transporte de texto (`server/generation/transport.ts`) só faz
// `createOpenAI(baseUrl).chat(model)` + `generateText`. Imagem, áudio e vídeo
// NÃO passam por aí: `/images/generations` é outro endpoint, e o Google e o
// ElevenLabs nem sequer são OpenAI-compatible.
//
// Daí um registry com um adaptador por (provider, modalidade), todos com a
// mesma assinatura. O dispatcher escolhe o adaptador e normaliza o resultado.
//
// A RESOLUÇÃO do modelo e os PREÇOS não vivem aqui: estão em `src/lib/media/`,
// que o browser também consegue importar. Ver `pricing.ts` para o porquê.
// =============================================================================

export type { MediaEstimate };

/** Pedido normalizado, independente do provider. */
export interface MediaRequest {
    /** Prompt portátil, já sem plataforma nem dimensões. */
    prompt: string;
    /** Só para imagem/vídeo. */
    negativePrompt?: string | null;
    /** Vai como PARÂMETRO, nunca dentro do prompt (ver Decisão 29). */
    aspectRatio?: string | null;
    /** Para áudio: o que deve ser dito, quando o prompt só descreve a locução. */
    text?: string | null;
    /** Vídeo: duração alvo em segundos. */
    durationSec?: number | null;
    /** ISO 639-1. */
    language?: string | null;
}

/** Ficheiro produzido. `url` pode ser um link temporário do provider. */
export interface MediaResult {
    /** Bytes do ficheiro — o dispatcher faz upload para o Storage. */
    bytes: Uint8Array;
    mimeType: string;
    /** Nome de ficheiro sugerido (sem caminho). */
    filename: string;
    /** Para depuração: o request exacto enviado ao provider. */
    debugUrl?: string | null;
}

/**
 * Um adaptador. `generate` pode bloquear (síncrono) ou devolver `pendingOperation`
 * para polling — o `veo-3` é deste último tipo.
 */
export interface MediaAdapter {
    /** `providerId` tal e qual como está em `ai_providers.providerId`. */
    providerId: string;
    modality: ArtifactModality;
    /**
     * Qualidade/preço aproximado, por unidade. Vem sempre de
     * `MODALITY_PRICES` (fonte única, partilhada com a UI). `undefined` é
     * legítimo: significa "não sabemos o preço", e a estimativa sai `null`
     * em vez de inventar um número.
     */
    estimate?: MediaEstimate;
    generate(
        apiKey: string,
        baseUrl: string,
        request: MediaRequest,
        signal?: AbortSignal
    ): Promise<MediaResult>;
}

/** Campos de contexto que `MediaAdapterError` acrescenta à mensagem. */
export interface MediaAdapterErrorContext {
    providerId: string;
    modality: ArtifactModality;
    cause?: unknown;
}

/**
 * Erro com contexto do provider, para a UI mostrar algo accionável.
 *
 * Campos próprios em vez de `constructor(readonly ...)` porque o `tsconfig`
 * deste projecto tem `erasableSyntaxOnly`, que não permite parameter
 * properties.
 */
export class MediaAdapterError extends Error {
    readonly providerId: string;
    readonly modality: ArtifactModality;
    readonly cause?: unknown;

    constructor(message: string, context: MediaAdapterErrorContext) {
        super(message);
        this.name = 'MediaAdapterError';
        this.providerId = context.providerId;
        this.modality = context.modality;
        this.cause = context.cause;
    }
}