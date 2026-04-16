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
    defaultTone: string | null;
    notes: string | null;
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

export type ContentFormat =
    | 'CAROUSEL'
    | 'SHORT_VIDEO'
    | 'LINKEDIN_POST'
    | 'IMAGE'
    | 'THREAD'
    | 'CTA_POST'
    | 'VIDEO_SCRIPT';

export type ContentPieceStatus =
    | 'DRAFT'
    | 'APPROVED'
    | 'SCHEDULED'
    | 'PUBLISHED';

export type ContentPillar =
    | 'P1_EDUCATION'
    | 'P2_USE_CASES'
    | 'P3_CONVERSION'
    | 'P4_AUTHORITY';

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
    CAROUSEL: 'Carrossel',
    SHORT_VIDEO: 'Short Video',
    LINKEDIN_POST: 'Post LinkedIn',
    IMAGE: 'Image',
    THREAD: 'Thread',
    CTA_POST: 'CTA Post',
    VIDEO_SCRIPT: 'Roteiro Vídeo',
};

export const CONTENT_FORMAT_ICONS: Record<ContentFormat, string> = {
    CAROUSEL: '📱',
    SHORT_VIDEO: '🎬',
    LINKEDIN_POST: '💼',
    IMAGE: '📸',
    THREAD: '🧵',
    CTA_POST: '🔗',
    VIDEO_SCRIPT: '📝',
};

export const CONTENT_FORMAT_DEFAULTS: Record<ContentFormat, SocialChannel> = {
    CAROUSEL: 'LINKEDIN',
    SHORT_VIDEO: 'TIKTOK',
    LINKEDIN_POST: 'LINKEDIN',
    IMAGE: 'INSTAGRAM',
    THREAD: 'TWITTER',
    CTA_POST: 'LINKEDIN',
    VIDEO_SCRIPT: 'TIKTOK',
};

export const CONTENT_PIECE_STATUS_LABELS: Record<ContentPieceStatus, string> = {
    DRAFT: 'Rascunho',
    APPROVED: 'Aprovado',
    SCHEDULED: 'Agendado',
    PUBLISHED: 'Publicado',
};

export const CONTENT_PIECE_STATUS_COLORS: Record<
    ContentPieceStatus,
    { bg: string; text: string }
> = {
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

export interface ContentPieceWithRelations extends ContentPiece {
    article?: { id: string; title: string };
    product?: { id: string; name: string } | null;
    channel?: {
        id: string;
        channel: SocialChannel;
        handle: string | null;
    } | null;
}
