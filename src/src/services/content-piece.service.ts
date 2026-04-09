import { supabase } from '@/lib/supabase';
import type {
    ContentFormat,
    ContentPiece,
    ContentPieceStatus,
    ContentPieceWithRelations,
    ContentPillar,
    ContentSlide,
} from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

export interface CreateContentPieceInput {
    articleId: string;
    workspaceId: string;
    format: ContentFormat;
    productId?: string | null;
    channelId?: string | null;
    pillar?: ContentPillar | null;
    title?: string | null;
    body: string;
    hookText?: string | null;
    ctaText?: string | null;
    hashtags?: string[];
    slides?: ContentSlide[] | null;
    slideCount?: number | null;
    aiGenerated?: boolean;
}

export interface UpdateContentPieceInput {
    title?: string | null;
    body?: string;
    hookText?: string | null;
    ctaText?: string | null;
    hashtags?: string[];
    slides?: ContentSlide[] | null;
    slideCount?: number | null;
    channelId?: string | null;
    pillar?: ContentPillar | null;
}

export const contentPieceService = {
    async getContentPieces(
        articleId: string
    ): Promise<ContentPieceWithRelations[]> {
        const { data, error } = await supabase
            .from('content_pieces')
            .select(
                `
                *,
                article:articles(id, title),
                product:products(id, name),
                channel:channel_configs(id, channel, handle)
            `
            )
            .eq('articleId', articleId)
            .order('createdAt', { ascending: false });

        if (error) {
            throw new Error(
                `Erro ao buscar peças de conteúdo: ${error.message}`
            );
        }

        return (data || []) as ContentPieceWithRelations[];
    },

    async getContentPiece(
        id: string
    ): Promise<ContentPieceWithRelations | null> {
        const { data, error } = await supabase
            .from('content_pieces')
            .select(
                `
                *,
                article:articles(id, title),
                product:products(id, name),
                channel:channel_configs(id, channel, handle)
            `
            )
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(
                `Erro ao buscar peça de conteúdo: ${error.message}`
            );
        }

        return data as ContentPieceWithRelations;
    },

    async createContentPiece(
        input: CreateContentPieceInput
    ): Promise<ContentPiece> {
        const id = uuidv4();

        const { data, error } = await supabase
            .from('content_pieces')
            .insert({
                id,
                articleId: input.articleId,
                workspaceId: input.workspaceId,
                productId: input.productId || null,
                channelId: input.channelId || null,
                format: input.format,
                pillar: input.pillar || null,
                title: input.title || null,
                body: input.body,
                hookText: input.hookText || null,
                ctaText: input.ctaText || null,
                hashtags: input.hashtags || [],
                slides: input.slides || null,
                slideCount: input.slideCount || null,
                status: 'DRAFT',
                aiGenerated: input.aiGenerated || false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar peça de conteúdo: ${error.message}`);
        }

        return data as ContentPiece;
    },

    async updateContentPiece(
        id: string,
        input: UpdateContentPieceInput
    ): Promise<ContentPiece> {
        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };

        if (input.title !== undefined) updateData.title = input.title;
        if (input.body !== undefined) updateData.body = input.body;
        if (input.hookText !== undefined) updateData.hookText = input.hookText;
        if (input.ctaText !== undefined) updateData.ctaText = input.ctaText;
        if (input.hashtags !== undefined) updateData.hashtags = input.hashtags;
        if (input.slides !== undefined) updateData.slides = input.slides;
        if (input.slideCount !== undefined)
            updateData.slideCount = input.slideCount;
        if (input.channelId !== undefined)
            updateData.channelId = input.channelId;
        if (input.pillar !== undefined) updateData.pillar = input.pillar;

        const { data, error } = await supabase
            .from('content_pieces')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(
                `Erro ao atualizar peça de conteúdo: ${error.message}`
            );
        }

        return data as ContentPiece;
    },

    async updateStatus(
        id: string,
        status: ContentPieceStatus
    ): Promise<ContentPiece> {
        const updateData: Record<string, unknown> = {
            status,
            updatedAt: new Date().toISOString(),
        };

        if (status === 'PUBLISHED') {
            updateData.publishedAt = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('content_pieces')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao atualizar status: ${error.message}`);
        }

        return data as ContentPiece;
    },

    async deleteContentPiece(id: string): Promise<void> {
        const { error } = await supabase
            .from('content_pieces')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(
                `Erro ao eliminar peça de conteúdo: ${error.message}`
            );
        }
    },

    async bulkCreate(
        pieces: CreateContentPieceInput[]
    ): Promise<ContentPiece[]> {
        const now = new Date().toISOString();

        const inserts = pieces.map((input) => ({
            id: uuidv4(),
            articleId: input.articleId,
            workspaceId: input.workspaceId,
            productId: input.productId || null,
            channelId: input.channelId || null,
            format: input.format,
            pillar: input.pillar || null,
            title: input.title || null,
            body: input.body,
            hookText: input.hookText || null,
            ctaText: input.ctaText || null,
            hashtags: input.hashtags || [],
            slides: input.slides || null,
            slideCount: input.slideCount || null,
            status: 'DRAFT' as const,
            aiGenerated: input.aiGenerated || false,
            createdAt: now,
            updatedAt: now,
        }));

        const { data, error } = await supabase
            .from('content_pieces')
            .insert(inserts)
            .select();

        if (error) {
            throw new Error(
                `Erro ao criar peças de conteúdo: ${error.message}`
            );
        }

        return data as ContentPiece[];
    },
};
