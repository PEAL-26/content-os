export interface Workspace {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    sector: string | null;
    website: string | null;
    createdAt: string;
    updatedAt: string;
    voiceTone: string | null;
    targetAudience: string | null;
    contentLanguage: string;
    valueProposition: string | null;
    valueRatio: number;
    productRatio: number;
    postsPerWeek: number;
    articlesPerWeek: number;
    defaultAIProviderId?: string | null;
    defaultAIModel?: string | null;
    /** Modelo por modalidade de media: `{ image?, audio?, video? }` com modelCode. */
    artifactModels?: { image?: string; audio?: string; video?: string } | null;
}

export interface WorkspaceMember {
    id: string;
    workspaceId: string;
    userId: string;
    role: 'OWNER' | 'EDITOR' | 'VIEWER';
    joinedAt: string;
}

export interface WorkspaceWithRole extends Workspace {
    memberRole?: 'OWNER' | 'EDITOR' | 'VIEWER';
    joinedAt?: string;
    memberCount?: number;
}

export interface Product {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    description: string | null;
    tagline: string | null;
    landingUrl: string | null;
    demoUrl: string | null;
    targetAudience: string | null;
    problemSolved: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export type SocialChannel =
    | 'LINKEDIN'
    | 'INSTAGRAM'
    | 'TIKTOK'
    | 'YOUTUBE'
    | 'TWITTER'
    | 'FACEBOOK'
    | 'THREADS'
    | 'PINTEREST'
    | 'TELEGRAM'
    | 'WHATSAPP';

export interface ChannelConfig {
    id: string;
    workspaceId: string;
    channel: SocialChannel;
    isActive: boolean;
    handle: string | null;
    isPrimary: boolean;
    /** Tom deste canal. Sobrepõe o `voiceTone` do workspace quando preenchido. */
    defaultTone: string | null;
    /**
     * Instruções internas deste canal — são enviadas ao modelo em cada
     * geração para este canal. Antes eram "notas para a equipa" e nunca eram
     * lidas por nenhum prompt builder.
     */
    notes: string | null;
    /** Overrides das regras de plataforma (campo-a-campo sobre os defaults). */
    rules: unknown;
    createdAt: string;
}

export const ALL_CHANNELS: SocialChannel[] = [
    'LINKEDIN',
    'INSTAGRAM',
    'TIKTOK',
    'YOUTUBE',
    'TWITTER',
    'FACEBOOK',
    'THREADS',
    'PINTEREST',
    'TELEGRAM',
    'WHATSAPP',
];

export const CHANNEL_LABELS: Record<SocialChannel, string> = {
    LINKEDIN: 'LinkedIn',
    INSTAGRAM: 'Instagram',
    TIKTOK: 'TikTok',
    YOUTUBE: 'YouTube',
    TWITTER: 'X / Twitter',
    FACEBOOK: 'Facebook',
    THREADS: 'Threads',
    PINTEREST: 'Pinterest',
    TELEGRAM: 'Telegram',
    WHATSAPP: 'WhatsApp',
};

export const CHANNEL_COLORS: Record<
    SocialChannel,
    { bg: string; text: string; icon: string }
> = {
    LINKEDIN: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '#0A66C2' },
    INSTAGRAM: { bg: 'bg-pink-100', text: 'text-pink-700', icon: '#E4405F' },
    TIKTOK: { bg: 'bg-gray-900', text: 'text-white', icon: '#000000' },
    YOUTUBE: { bg: 'bg-red-100', text: 'text-red-700', icon: '#FF0000' },
    TWITTER: { bg: 'bg-sky-100', text: 'text-sky-700', icon: '#1DA1F2' },
    FACEBOOK: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '#1877F2' },
    THREADS: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '#000000' },
    PINTEREST: { bg: 'bg-red-100', text: 'text-red-700', icon: '#E60023' },
    TELEGRAM: { bg: 'bg-sky-100', text: 'text-sky-700', icon: '#26A5E4' },
    WHATSAPP: { bg: 'bg-green-100', text: 'text-green-700', icon: '#25D366' },
};

export const VOICE_TONES = [
    { value: '', label: 'Padrão do workspace' },
    { value: 'formal', label: 'Formal' },
    { value: 'directo', label: 'Direto' },
    { value: 'tecnico', label: 'Técnico' },
    { value: 'casual', label: 'Casual' },
    { value: 'custom', label: 'Personalizado...' },
] as const;

export type ArticleStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
    DRAFT: 'Rascunho',
    REVIEW: 'Em revisão',
    APPROVED: 'Aprovado',
    PUBLISHED: 'Publicado',
};

export const ARTICLE_STATUS_COLORS: Record<
    ArticleStatus,
    { bg: string; text: string }
> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
    REVIEW: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
    PUBLISHED: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

export interface Article {
    id: string;
    workspaceId: string;
    productId: string | null;
    pillarId: string | null;
    title: string;
    slug: string;
    summary: string | null;
    body: string;
    seoTitle: string | null;
    seoDescription: string | null;
    keywords: string[];
    status: ArticleStatus;
    publishedAt: string | null;
    publishedUrl: string | null;
    aiGenerated: boolean;
    aiPromptUsed: string | null;
    readingTimeMin: number | null;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
}

export interface ArticleWithRelations extends Article {
    product?: { id: string; name: string } | null;
    pillar?: { id: string; pillar: string; name: string } | null;
    _count?: {
        contentPieces: number;
    };
}

export type ContentFormat = 'POST' | 'CAROUSEL' | 'IMAGE' | 'SHORT_VIDEO' | 'VIDEO';

export type ContentPieceStatus =
    | 'PROMPT_READY'
    | 'DRAFT'
    | 'APPROVED'
    | 'SCHEDULED'
    | 'PUBLISHED';

export type ContentPillar =
    | 'P1_EDUCATION'
    | 'P2_USE_CASES'
    | 'P3_CONVERSION'
    | 'P4_AUTHORITY';

// Os rótulos são de TIPO, nunca de plataforma. O nome da plataforma entra no
// prompt no bloco fixo de plataforma, depois do prompt de sistema editável.
export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
    POST: 'Post',
    CAROUSEL: 'Carrossel',
    IMAGE: 'Image',
    SHORT_VIDEO: 'Short Video',
    VIDEO: 'Vídeo',
};

export const CONTENT_FORMAT_ICONS: Record<ContentFormat, string> = {
    POST: '💬',
    CAROUSEL: '📱',
    IMAGE: '📸',
    SHORT_VIDEO: '🎬',
    VIDEO: '🎥',
};

/**
 * Canal pré-sugerido por tipo. Só usado como valor inicial do picker — a
 * ordenação fina faz-se por `platform-rules.sortTypesByFit`, que conhece as
 * capacidades reais de cada plataforma.
 */
export const CONTENT_FORMAT_DEFAULTS: Record<ContentFormat, SocialChannel> = {
    POST: 'LINKEDIN',
    CAROUSEL: 'INSTAGRAM',
    IMAGE: 'INSTAGRAM',
    SHORT_VIDEO: 'TIKTOK',
    VIDEO: 'YOUTUBE',
};

export const CONTENT_PIECE_STATUS_LABELS: Record<ContentPieceStatus, string> = {
    PROMPT_READY: 'Prompt pronto',
    DRAFT: 'Rascunho',
    APPROVED: 'Aprovado',
    SCHEDULED: 'Agendado',
    PUBLISHED: 'Publicado',
};

export const CONTENT_PIECE_STATUS_COLORS: Record<
    ContentPieceStatus,
    { bg: string; text: string }
> = {
    PROMPT_READY: { bg: 'bg-amber-100', text: 'text-amber-800' },
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
    APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
    SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700' },
    PUBLISHED: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

export type PlanItemStatus = 'PLANNED' | 'PUBLISHED' | 'SKIPPED';

export const PLAN_ITEM_STATUS_LABELS: Record<PlanItemStatus, string> = {
    PLANNED: 'Planeado',
    PUBLISHED: 'Publicado',
    SKIPPED: 'Ignorado',
};

export interface ContentPiece {
    id: string;
    articleId: string;
    workspaceId: string;
    productId: string | null;
    channelId: string | null;
    format: ContentFormat;
    pillar: ContentPillar | null;
    title: string | null;
    body: string;
    hookText: string | null;
    ctaText: string | null;
    hashtags: string[];
    slides: ContentSlide[] | null;
    slideCount: number | null;
    /** Decomposição em cenas — só em SHORT_VIDEO / VIDEO. */
    scenes: ContentScene[] | null;
    durationSec: number | null;
    status: ContentPieceStatus;
    publishedAt: string | null;
    aiGenerated: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ContentSlide {
    order: number;
    title: string;
    body: string;
}

/** Uma cena do vídeo. `kind` ajuda a IA a manter o arco narrativo. */
export interface ContentScene {
    order: number;
    kind: 'hook' | 'problem' | 'solution' | 'cta' | string;
    narration: string;
    visual?: string | null;
    onScreenText?: string | null;
}

export interface ContentPieceWithRelations extends ContentPiece {
    article?: { id: string; title: string };
    product?: { id: string; name: string } | null;
    channel?: {
        id: string;
        channel: SocialChannel;
        handle: string | null;
    } | null;
}

// =============================================================================
// AI SYSTEM PROMPTS (globais por tipo de conteúdo, nunca por provider)
// =============================================================================

export type AISystemPromptScope =
    | { type: 'user'; userId: string }
    | { type: 'workspace'; workspaceId: string };

export interface AISystemPrompt {
    id: string;
    userId: string | null;
    workspaceId: string | null;
    contentType: string; // 'article' | ContentFormat (ex: 'CAROUSEL')
    systemPrompt: string;
    createdAt: string;
    updatedAt: string;
}

// =============================================================================
// CONTENT GENERATION PROMPTS (prompt final portátil por item de peça)
// =============================================================================

export type GenerationPromptTargetType = 'PIECE';

export interface ContentGenerationPrompt {
    id: string;
    targetType: GenerationPromptTargetType;
    targetId: string;
    itemKey: string | null; // 'main' | 'slide-1' | 'scene-3' | ...
    prompt: string;
    providerId: string | null;
    modelCode: string | null;
    createdAt: string;
}

// =============================================================================
// CONTENT MEDIA PROMPTS (prompt genérico e portátil de imagem/áudio/vídeo)
// =============================================================================

/**
 * Modalidade de media. É também o valor de `ContentMediaPrompt.modality` e o
 * que casa com `AIProviderModel.modalities`.
 */
export type MediaModality = 'image' | 'audio' | 'video';

export const MEDIA_MODALITIES: MediaModality[] = ['image', 'audio', 'video'];

export const MEDIA_MODALITY_LABELS: Record<MediaModality, string> = {
    image: 'Imagem',
    audio: 'Áudio',
    video: 'Vídeo',
};

export interface ContentMediaPrompt {
    id: string;
    workspaceId: string;
    targetType: AssetTargetType;
    targetId: string;
    modality: MediaModality;
    /** 'main' | 'slide-N' | 'scene-N' | 'ilustracao-N' */
    itemKey: string;
    /** Prompt portátil: só descrição. Nunca plataforma nem dimensões. */
    prompt: string;
    negativePrompt: string | null;
    aspectRatio: string | null;
    providerId: string | null;
    modelCode: string | null;
    createdAt: string;
    editedAt: string | null;
}

/** Uma linha de `AIProviderModel.modalities`. */
export type ModelModality = MediaModality | 'text' | 'embedding' | 'other';

export const MODEL_MODALITIES: ModelModality[] = [
    'text',
    'image',
    'audio',
    'video',
    'embedding',
    'other',
];

export const MODEL_MODALITY_LABELS: Record<ModelModality, string> = {
    text: 'Texto',
    image: 'Imagem',
    audio: 'Áudio',
    video: 'Vídeo',
    embedding: 'Embeddings',
    other: 'Outro',
};

// =============================================================================
// CONTENT PUBLICATIONS (publicações multi-plataforma, polimórfico)
// =============================================================================

export type PublicationTargetType = 'ARTICLE' | 'PIECE';

export interface ContentPublication {
    id: string;
    targetType: PublicationTargetType;
    targetId: string;
    /** Plataforma real onde foi publicado (enum único, não texto livre). */
    platform: SocialChannel | null;
    url: string;
    publishedAt: string;
    createdAt: string;
}

// =============================================================================
// CONTENT ASSETS (artefactos, vários por entidade, polimórfico)
// Substitui as antigas colunas assetUrl/assetName, que só permitiam um
// artefacto por artigo/peça.
// =============================================================================

export type AssetTargetType = 'ARTICLE' | 'PIECE';

/** Como nasceu o ficheiro. */
export type AssetSource = 'UPLOAD' | 'GENERATED';

export const ASSET_SOURCE_LABELS: Record<AssetSource, string> = {
    UPLOAD: 'Carregado',
    GENERATED: 'Gerado por IA',
};

/** Só os artefactos gerados usam os estados intermédios. */
export type AssetStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
    PENDING: 'Em fila',
    GENERATING: 'A gerar',
    READY: 'Pronto',
    FAILED: 'Falhou',
};

export interface ContentAsset {
    id: string;
    workspaceId: string;
    targetType: AssetTargetType;
    targetId: string;
    /** URL do Storage ou link externo. */
    url: string;
    name: string | null;
    /** MIME do upload; para links externos, inferido da extensão. */
    mimeType: string | null;
    source: AssetSource;
    status: AssetStatus;
    /** Motivo da falha (só em GENERATED). */
    error: string | null;
    /** 'main' | 'slide-2' | 'scene-1' | 'ilustracao-1' */
    itemKey: string | null;
    /** Prompt de media que gerou este ficheiro. */
    mediaPromptId: string | null;
    providerId: string | null;
    modelCode: string | null;
    createdAt: string;
}

/** Como o painel desenha cada artefacto, a partir do mimeType. */
export type AssetKind = 'image' | 'video' | 'file';

/**
 * Mapa extensão -> MIME usado na inferência do `mimeType`.
 *
 * Construído SEM_protótipo (`Object.create(null)`): indexado diretamente, um
 * URL como `https://x/a.constructor` ia devolver o construtor de `Object`
 * herdado da cadeia de protótipos, e `https://x/a.__proto__` devolvia o
 * prototype inteiro. `sniffMimeType` também filtra com `Object.hasOwn`.
 */
export const ASSET_MIME_BY_EXTENSION: Record<string, string> = Object.assign(
    Object.create(null) as Record<string, string>,
    {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        avif: 'image/avif',
        heic: 'image/heic',
        mp4: 'video/mp4',
        m4v: 'video/x-m4v',
        webm: 'video/webm',
        mov: 'video/quicktime',
        pdf: 'application/pdf',
        zip: 'application/zip',
    }
);
