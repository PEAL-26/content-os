// =============================================================================
// Geração de IA assíncrona (Inngest) — TIPOS PARTILHADOS server + client.
// Ficheiro puro (sem imports de runtime): o `params` no generation_jobs é um
// snapshot JSON destes tipos (serializável) usado no retry "Tentar novamente".
// =============================================================================

export type GenerationJobTypeValue =
    | 'NEW_ARTICLE'
    | 'CONTENT_PIECES'
    | 'CONTENT_PROMPT'
    | 'CONTENT_ITEM'
    | 'ARTICLE_METADATA'
    | 'MEDIA_PROMPT'
    | 'MEDIA_ARTIFACT';

export type GenerationJobStatusValue =
    | 'QUEUED'
    | 'RUNNING'
    | 'COMPLETED'
    | 'FAILED'
    /** Job invalidado por uma migração (params com formatos que já não existem). */
    | 'EXPIRED';

/**
 * Campos de metadados do artigo que a IA pode gerar. Vêm do mesmo grupo dos 4
 * derivados que o `NEW_ARTICLE` escreve; `title`, `slug`, `pillarId` e `productId`
 * ficam de fora de propósito (identidade editorial, URL pública e classificação).
 *
 * Vive aqui — e não no módulo de prompts — porque é o contrato partilhado entre
 * `generation_jobs.items.format`, o zod do enqueue e a UI.
 */
export type MetadataField =
    | 'summary'
    | 'keywords'
    | 'seoTitle'
    | 'seoDescription';

/**
 * ARTICLE_METADATA — preenche os metadados em falta de um artigo JÁ EXISTENTE
 * (ao contrário do NEW_ARTICLE, que escreve o artigo inteiro). Uma única chamada
 * ao modelo cobre os N campos pedidos: `items` fica com um item por campo, o que
 * dá estado/spinner/erro/retry independentes sem machinery nova.
 */
export interface ArticleMetadataJobParams {
    articleId: string;
    /** Campos a gerar (1..4 — o zod do enqueue recusa lista vazia). */
    fields: MetadataField[];
    /** Instruções adicionais por geração (anexadas ao system prompt). */
    additionalInstructions?: string;
    preferred?: GenerationPreferred | null;
}

/** Segmento de `generation_jobs.items` — estado por item da geração. */
export interface GenerationJobItem {
    /**
     * Identifica o item dentro do job. Não é só para display: `runMediaPrompt`
     * e `runMediaArtifact` usam-no para achar o `itemKey` do prompt.
     */
    format: string;
    /** articles.id | content_pieces.id | content_media_prompts.id */
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

/**
 * CONTENT_PIECES — gera uma peça por par (canal, tipo).
 *
 * Os canais são uma LISTA e os tipos são uma LISTA: o produto cartesiano é o que
 * faz "POST para LinkedIn e POST para Instagram na mesma corrida" ser possível
 * (antes havia um canal por tipo, o que nem permitia pedir o mesmo tipo duas
 * vezes em canais diferentes).
 */
export interface ContentPiecesJobParams {
    articleId: string;
    /** Tipos genéricos a gerar (subset de `ALL_CONTENT_FORMATS`). */
    formats: string[];
    /** Canais destino. O produto cartesiano com `formats` define as peças. */
    channelIds: string[];
    productId?: string | null;
    pillarId?: string | null;
    additionalInstructions?: string;
    /**
     * Usa o prompt gravado da peça (itemKey 'main') como mensagem de geração em
     * vez do contexto automático. Exige que a peça tenha prompt gravado.
     */
    useStoredPrompt?: boolean;
    preferred?: GenerationPreferred | null;
    /**
     * Modalidades cujos prompts de media devem ser gerados automaticamente
     * depois de a peça existir. Os ARTEFACTOS nunca correm automaticamente —
     * precisam de confirmação com estimativa de custo (Decisão 27).
     */
    modalities?: string[];
}

/**
 * CONTENT_PROMPT — escreve o prompt de cada peça (sem gerar o conteúdo).
 * Os params são os mesmos de CONTENT_PIECES: o enqueue cria as peças em
 * PROMPT_READY e o job grava o prompt de cada uma.
 */
export type ContentPromptJobParams = ContentPiecesJobParams;

/**
 * CONTENT_ITEM — regenera UM item da peça (slide-N / scene-N) a partir do prompt
 * gravado para esse item.
 *
 * Regenera também o prompt de media desse item (Decisão 30): deixar o prompt a
 * descrever um slide que já não existe é pior do que não ter prompt.
 */
export interface ContentItemJobParams {
    pieceId: string;
    itemKey: string;
    /** Regenera também o prompt de media do item. */
    regenerateMediaPrompt?: boolean;
    /**
     * Regenera também o FICHEIRO (Decisão 30). Desligado por omissão: é uma
     * chamada paga (até ~$22 num vídeo) e "gerar este slide" não tem de
     * implicar pagar outra geração.
     */
    regenerateArtifact?: boolean;
    preferred?: GenerationPreferred | null;
}

/**
 * MEDIA_PROMPT — escreve os prompts de media (imagem/áudio/vídeo) de um alvo.
 *
 * Corre AUTOMATICAMENTE depois de a peça existir, porque um prompt é barato. Os
 * artefactos ficam para `MEDIA_ARTIFACT`, que exige confirmação de custo.
 */
export interface MediaPromptJobParams {
    /** articles.id | content_pieces.id */
    targetId: string;
    targetType: 'ARTICLE' | 'PIECE';
    modalities: string[];
    /** Refaz prompts que já existem (por defeito só escreve os que faltam). */
    overwrite?: boolean;
    preferred?: GenerationPreferred | null;
}

/**
 * MEDIA_ARTIFACT — gera o ficheiro de media a partir de um prompt já guardado.
 *
 * Só corre depois de confirmação com estimativa de custo, e escreve o ficheiro no
 * bucket `generated` com `content_assets.status` a transicionar
 * PENDING → GENERATING → READY/FAILED.
 */
export interface MediaArtifactJobParams {
    /** content_media_prompts.id */
    mediaPromptId: string;
    /** content_assets.id — criado em PENDING antes de o job correr. */
    assetId: string;
    /** Modelo forçado (a UI pode não querer o automático). */
    providerTechnicalId?: string | null;
    modelCode?: string | null;
}

/** Params por jobType (snapshot para retry). */
export type GenerationJobParams =
    | NewArticleJobParams
    | ContentPiecesJobParams
    | ContentItemJobParams
    | ArticleMetadataJobParams
    | MediaPromptJobParams
    | MediaArtifactJobParams;

/**
 * Como usar um target existente quando se regenera.
 * FILL (default) regenera por cima; NEW_VERSION clona a peça (nova versão).
 * Vive aqui — e não em `enqueue.ts`/`generation-job.service.ts` — porque é o
 * contrato partilhado entre o servidor e o browser para o mesmo campo.
 */
export type TargetMode = 'FILL' | 'NEW_VERSION';

/** itemKey do prompt que representa a peça inteira (não um item). */
export const MAIN_ITEM_KEY = 'main';

/**
 * Extrai o número de um itemKey 'slide-3' / 'scene-2' / 'ilustracao-4'.
 * Aceita os três prefixos porque `helpers/content-format.ts` gera os chaves com
 * `scene-N` (e o histórico tem `slide-N`).
 */
export function parseItemKeyOrder(itemKey: string): number | null {
    const match = /^(?:slide|scene|tweet|ilustracao)-(\d+)$/.exec(itemKey);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isInteger(n) ? n : null;
}

/** `itemKey` normalizado de um item de peça: sempre `slide-N` ou `scene-N`. */
export function itemKeyFor(
    kind: 'slide' | 'scene',
    order: number
): string {
    return `${kind}-${order}`;
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
    params: Record<string, unknown> | null;
    runId: string | null;
    targetId: string | null;
    createdAt: string;
    updatedAt: string;
    /** Presente nas listas com join (nome do tipo de conteúdo). */
    contentTitle?: string | null;
    articleTitle?: string | null;
}