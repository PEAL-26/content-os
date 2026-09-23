// =============================================================================
// Geração de IA assíncrona (Inngest) — TIPOS PARTILHADOS server + client.
// Ficheiro puro (sem imports de runtime): o `params` no generation_jobs é um
// snapshot JSON destes tipos (serializável) usado no retry "Tentar novamente".
// =============================================================================

export type GenerationJobTypeValue =
    | 'NEW_ARTICLE'
    | 'CONTENT_PIECES'
    | 'VIDEO_SCRIPT';

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
    preferred?: GenerationPreferred | null;
}

export interface VideoScriptJobParams {
    articleId: string;
    targetChannel: string;
    durationSec: number;
    additionalInstructions?: string;
    preferred?: GenerationPreferred | null;
}

/** Params por jobType (snapshot para retry). */
export type GenerationJobParams =
    | NewArticleJobParams
    | ContentPiecesJobParams
    | VideoScriptJobParams;

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