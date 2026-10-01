// =============================================================================
// Geração de IA assíncrona (Inngest) — TIPOS PARTILHADOS server + client.
// Ficheiro puro (sem imports de runtime): o `params` no generation_jobs é um
// snapshot JSON destes tipos (serializável) usado no retry "Tentar novamente".
// =============================================================================

export type GenerationJobTypeValue =
    | 'NEW_ARTICLE'
    | 'CONTENT_PIECES'
    | 'VIDEO_SCRIPT'
    | 'CONTENT_PROMPT'
    | 'CONTENT_ITEM';

export type GenerationJobStatusValue =
    | 'QUEUED'
    | 'RUNNING'
    | 'COMPLETED'
    | 'FAILED';

/** Segmento de `generation_jobs.items` — estado por item da geração. */
export interface GenerationJobItem {
    /** 'NEW_ARTICLE' | ContentFormat ('CAROUSEL', …) | 'VIDEO_SCRIPT' */
    format: string;
    /** articles.id | content_pieces.id | video_scripts.id (placeholder) */
    targetId: string;
    status: GenerationJobStatusValue;
    /** Motivo quando FAILED (visível na UI por item). */
    error: string | null;
}

export interface GenerationPreferred {
    providerId?: string | null;
    modelCode?: string | null;
}

export interface NewArticleJobParams {
    topic: string;
    pillarId?: string | null;
    productId?: string | null;
    /** Instruções adicionais por geração (anexadas ao system prompt). */
    additionalInstructions?: string;
    preferred?: GenerationPreferred | null;
}

export interface ContentPiecesJobParams {
    articleId: string;
    formats: string[];
    /** Canal destino por formato (content_pieces.channelId). */
    channelIds?: Record<string, string>;
    productId?: string | null;
    pillarId?: string | null;
    additionalInstructions?: string;
    /**
     * Usa o prompt gravado da peça (itemKey 'main') como mensagem de geração em
     * vez do contexto automático. Exige que a peça tenha prompt gravado.
     */
    useStoredPrompt?: boolean;
    preferred?: GenerationPreferred | null;
}

export interface VideoScriptJobParams {
    articleId: string;
    targetChannel: string;
    durationSec: number;
    additionalInstructions?: string;
    preferred?: GenerationPreferred | null;
}

/**
 * CONTENT_PROMPT — escreve o prompt de cada peça (sem gerar o conteúdo).
 * Os params são os mesmos de CONTENT_PIECES: o enqueue cria as peças em
 * PROMPT_READY e o job grava o prompt de cada uma.
 */
export type ContentPromptJobParams = ContentPiecesJobParams;

/**
 * CONTENT_ITEM — regenera UM item da peça (slide-N / tweet-N) a partir do prompt
 * gravado para esse item. `itemKey` = 'slide-2', 'tweet-3', ...
 */
export interface ContentItemJobParams {
    pieceId: string;
    itemKey: string;
    preferred?: GenerationPreferred | null;
}

/** Params por jobType (snapshot para retry). */
export type GenerationJobParams =
    | NewArticleJobParams
    | ContentPiecesJobParams
    | VideoScriptJobParams
    | ContentItemJobParams;

/**
 * Como usar um target existente quando se regenera.
 * FILL (default) regenera por cima; NEW_VERSION clona a peça (nova versão).
 * Vive aqui — e não em `enqueue.ts`/`generation-job.service.ts` — porque é o
 * contrato partilhado entre o servidor e o browser para o mesmo campo.
 */
export type TargetMode = 'FILL' | 'NEW_VERSION';

/** itemKey do prompt que representa a peça inteira (não um item). */
export const MAIN_ITEM_KEY = 'main';

/** Constrói o itemKey do prompt de um slide: 'slide-3'. */
export function slideItemKey(order: number): string {
    return `slide-${order}`;
}

/** Constrói o itemKey do prompt de um tweet: 'tweet-3'. */
export function tweetItemKey(order: number): string {
    return `tweet-${order}`;
}

/** Extrai o número de um itemKey 'slide-3' / 'tweet-3'; null se não for. */
export function parseItemKeyOrder(itemKey: string): number | null {
    const match = /^(?:slide|tweet)-(\d+)$/.exec(itemKey);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isInteger(n) ? n : null;
}

/** Linha de `generation_jobs` como a UI a lê (via supabase, RLS off). */
export interface GenerationJob {
    id: string;
    jobType: GenerationJobTypeValue;
    workspaceId: string;
    userId: string | null;
    status: GenerationJobStatusValue;
    error: string | null;
    items: GenerationJobItem[] | null;
    params: GenerationJobParams | null;
    runId: string | null;
    targetId: string | null;
    createdAt: string;
    updatedAt: string;
}