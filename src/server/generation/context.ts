import { prisma } from '../../src/lib/prisma.js';
import { normalizeConfig } from '../../src/lib/ai/resolver.js';
import type { AIProviderLike } from '../../src/lib/ai/types.js';
import type {
    Article,
    ContentPillar,
    ContentSlide,
    Product,
    Workspace,
} from '../../src/types/database.js';
import type { PillarConfig } from '../../src/types/pillar.js';
import type { GenerationPreferred } from './types.js';

// =============================================================================
// Contexto dos jobs de geração: carrega e mapeia as linhas Prisma para os
// shapes do núcleo puro (types/database, types/pillar) e os providers + chaves
// (em claro — o projeto não cifra; apiKeyEncrypted guarda a própria chave).
// =============================================================================

export interface GenerationContextData {
    workspace: Workspace;
    defaultPreferred: GenerationPreferred;
    providers: AIProviderLike[];
    apiKeys: Record<string, string>;
}

function toIso(date: Date): string {
    return date.toISOString();
}

export function toWorkspaceClient(ws: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    sector: string | null;
    website: string | null;
    voiceTone: string | null;
    targetAudience: string | null;
    contentLanguage: string;
    valueProposition: string | null;
    valueRatio: number;
    productRatio: number;
    postsPerWeek: number;
    articlesPerWeek: number;
    defaultAIProviderId: string | null;
    defaultAIModel: string | null;
    createdAt: Date;
    updatedAt: Date;
}): Workspace {
    return {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        description: ws.description,
        logoUrl: ws.logoUrl,
        sector: ws.sector,
        website: ws.website,
        createdAt: toIso(ws.createdAt),
        updatedAt: toIso(ws.updatedAt),
        voiceTone: ws.voiceTone,
        targetAudience: ws.targetAudience,
        contentLanguage: ws.contentLanguage,
        valueProposition: ws.valueProposition,
        valueRatio: ws.valueRatio,
        productRatio: ws.productRatio,
        postsPerWeek: ws.postsPerWeek,
        articlesPerWeek: ws.articlesPerWeek,
        defaultAIProviderId: ws.defaultAIProviderId ?? undefined,
        defaultAIModel: ws.defaultAIModel ?? undefined,
    };
}

export function toProductClient(p: {
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
    createdAt: Date;
    updatedAt: Date;
}): Product {
    return {
        id: p.id,
        workspaceId: p.workspaceId,
        name: p.name,
        slug: p.slug,
        description: p.description,
        tagline: p.tagline,
        landingUrl: p.landingUrl,
        demoUrl: p.demoUrl,
        targetAudience: p.targetAudience,
        problemSolved: p.problemSolved,
        isActive: p.isActive,
        createdAt: toIso(p.createdAt),
        updatedAt: toIso(p.updatedAt),
    };
}

export function toPillarClient(p: {
    id: string;
    workspaceId: string;
    pillar: ContentPillar;
    name: string;
    objective: string | null;
    funnelStage: string;
    description: string | null;
    examples: string[];
    isActive: boolean;
    sortOrder: number;
}): PillarConfig {
    return {
        id: p.id,
        workspaceId: p.workspaceId,
        pillar: p.pillar,
        name: p.name,
        objective: p.objective,
        funnelStage: p.funnelStage as PillarConfig['funnelStage'],
        description: p.description,
        examples: p.examples,
        isActive: p.isActive,
        sortOrder: p.sortOrder,
    };
}

export function toArticleClient(a: {
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
    status: string;
    publishedAt: Date | null;
    publishedUrl: string | null;
    aiGenerated: boolean;
    aiPromptUsed: string | null;
    readingTimeMin: number | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
}): Article {
    return {
        id: a.id,
        workspaceId: a.workspaceId,
        productId: a.productId,
        pillarId: a.pillarId,
        title: a.title,
        slug: a.slug,
        summary: a.summary,
        body: a.body,
        seoTitle: a.seoTitle,
        seoDescription: a.seoDescription,
        keywords: a.keywords,
        status: a.status as Article['status'],
        publishedAt: a.publishedAt ? toIso(a.publishedAt) : null,
        publishedUrl: a.publishedUrl,
        aiGenerated: a.aiGenerated,
        aiPromptUsed: a.aiPromptUsed,
        readingTimeMin: a.readingTimeMin,
        createdAt: toIso(a.createdAt),
        updatedAt: toIso(a.updatedAt),
        createdBy: a.createdBy,
    };
}

/** ContentSlide já é o shape final (order/title/body). */
export function slidesToClient(slides: unknown): ContentSlide[] | null {
    if (!Array.isArray(slides) || slides.length === 0) return null;
    return slides.map((s) => {
        const row = s as Record<string, unknown>;
        return {
            order: typeof row.order === 'number' ? row.order : 1,
            title: typeof row.title === 'string' ? row.title : '',
            body: typeof row.body === 'string' ? row.body : '',
        };
    });
}

/**
 * Providers activos (user OU workspace) com chave preenchida + modelos activos.
 * Devolve as chaves por row id (provider.id) — fonte única para o transporte.
 */
export async function loadAvailableProviders(
    workspaceId: string,
    userId?: string | null
): Promise<{ providers: AIProviderLike[]; apiKeys: Record<string, string> }> {
    const rows = await prisma.aIProvider.findMany({
        where: {
            isActive: true,
            apiKeyEncrypted: { not: null },
            OR: userId
                ? [{ userId }, { workspaceId }]
                : [{ workspaceId }],
        },
        include: {
            models: { where: { isActive: true } },
            headers: true,
        },
        orderBy: { priority: 'asc' },
    });

    const providers: AIProviderLike[] = [];
    const apiKeys: Record<string, string> = {};

    for (const row of rows) {
        const key = row.apiKeyEncrypted;
        if (!key) continue;

        apiKeys[row.id] = key;
        providers.push({
            id: row.id,
            providerId: row.providerId,
            name: row.name,
            description: row.description,
            baseUrl: row.baseUrl,
            userId: row.userId ?? undefined,
            workspaceId: row.workspaceId ?? undefined,
            apiKeyEncrypted: row.apiKeyEncrypted,
            apiKeyIv: row.apiKeyIv,
            config: normalizeConfig(row.config),
            isDefault: row.isDefault,
            isCustom: row.isCustom,
            isActive: row.isActive,
            priority: row.priority,
            createdAt: toIso(row.createdAt),
            updatedAt: toIso(row.updatedAt),
            models: row.models.map((m) => ({
                id: m.id,
                providerId: m.providerId,
                displayName: m.displayName,
                modelCode: m.modelCode,
                config: normalizeConfig(m.config),
                isActive: m.isActive,
                createdAt: toIso(m.createdAt),
            })),
            headers: row.headers.map((h) => ({
                id: h.id,
                providerId: h.providerId,
                key: h.key,
                value: h.value,
                createdAt: toIso(h.createdAt),
            })),
        });
    }

    return { providers, apiKeys };
}

/**
 * System prompt efetivo: override workspace > user > default em código.
 * Mesma semântica do client (ai-prompt.service.resolveSystemPrompt).
 */
export async function resolveSystemPrompt(
    workspaceId: string,
    userId: string | null | undefined,
    contentType: string,
    buildDefault: () => string
): Promise<string> {
    const wsRow = await prisma.aISystemPrompt.findFirst({
        where: { workspaceId, contentType },
    });
    if (wsRow?.systemPrompt) return wsRow.systemPrompt;

    if (userId) {
        const userRow = await prisma.aISystemPrompt.findFirst({
            where: { userId, contentType },
        });
        if (userRow?.systemPrompt) return userRow.systemPrompt;
    }

    return buildDefault();
}

/** Anexa as instruções adicionais (por geração) ao system prompt. */
export function withAdditionalInstructions(
    systemPrompt: string,
    additionalInstructions?: string
): string {
    return additionalInstructions?.trim()
        ? `${systemPrompt}\n\n## Instruções Adicionais\n${additionalInstructions.trim()}`
        : systemPrompt;
}

/**
 * Carrega tudo o que um job precisa para gerar: workspace (client shape),
 * providers + chaves e o default preferido do workspace.
 */
export async function loadGenerationContext(
    workspaceId: string,
    userId?: string | null
): Promise<GenerationContextData> {
    const workspaceRow = await prisma.workspace.findUnique({
        where: { id: workspaceId },
    });
    if (!workspaceRow) {
        throw new Error(`Workspace não encontrado: ${workspaceId}`);
    }

    const { providers, apiKeys } = await loadAvailableProviders(
        workspaceId,
        userId
    );

    return {
        workspace: toWorkspaceClient(workspaceRow),
        defaultPreferred: {
            providerId: workspaceRow.defaultAIProviderId,
            modelCode: workspaceRow.defaultAIModel,
        },
        providers,
        apiKeys,
    };
}