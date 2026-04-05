export interface Workspace {
    id: string
    name: string
    slug: string
    description: string | null
    logoUrl: string | null
    sector: string | null
    website: string | null
    createdAt: string
    updatedAt: string
    voiceTone: string | null
    targetAudience: string | null
    contentLanguage: string
    valueProposition: string | null
    valueRatio: number
    productRatio: number
    postsPerWeek: number
    articlesPerWeek: number
}

export interface WorkspaceMember {
    id: string
    workspaceId: string
    userId: string
    role: 'OWNER' | 'EDITOR' | 'VIEWER'
    joinedAt: string
}

export interface WorkspaceWithRole extends Workspace {
    memberRole?: 'OWNER' | 'EDITOR' | 'VIEWER'
}

export interface Product {
    id: string
    workspaceId: string
    name: string
    slug: string
    description: string | null
    tagline: string | null
    landingUrl: string | null
    demoUrl: string | null
    targetAudience: string | null
    problemSolved: string | null
    isActive: boolean
    createdAt: string
    updatedAt: string
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
    | 'WHATSAPP'

export interface ChannelConfig {
    id: string
    workspaceId: string
    channel: SocialChannel
    isActive: boolean
    handle: string | null
    isPrimary: boolean
    defaultTone: string | null
    notes: string | null
    createdAt: string
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
]

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
}

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
}

export const VOICE_TONES = [
    { value: '', label: 'Padrão do workspace' },
    { value: 'formal', label: 'Formal' },
    { value: 'directo', label: 'Direto' },
    { value: 'tecnico', label: 'Técnico' },
    { value: 'casual', label: 'Casual' },
    { value: 'custom', label: 'Personalizado...' },
] as const

export type ArticleStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED'

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
    DRAFT: 'Rascunho',
    REVIEW: 'Em revisão',
    APPROVED: 'Aprovado',
    PUBLISHED: 'Publicado',
}

export const ARTICLE_STATUS_COLORS: Record<
    ArticleStatus,
    { bg: string; text: string }
> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
    REVIEW: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
    PUBLISHED: { bg: 'bg-blue-100', text: 'text-blue-700' },
}

export interface Article {
    id: string
    workspaceId: string
    productId: string | null
    pillarId: string | null
    title: string
    slug: string
    summary: string | null
    body: string
    seoTitle: string | null
    seoDescription: string | null
    keywords: string[]
    status: ArticleStatus
    publishedAt: string | null
    publishedUrl: string | null
    aiGenerated: boolean
    aiPromptUsed: string | null
    readingTimeMin: number | null
    createdAt: string
    updatedAt: string
    createdBy: string | null
}

export interface ArticleWithRelations extends Article {
    product?: { id: string; name: string } | null
    pillar?: { id: string; pillar: string; name: string } | null
    _count?: {
        contentPieces: number
    }
}
