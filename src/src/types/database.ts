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
