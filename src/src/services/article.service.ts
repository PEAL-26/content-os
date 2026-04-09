import type {
    CreateArticleInput,
    UpdateArticleInput,
} from '@/lib/schemas/article';
import { supabase } from '@/lib/supabase';
import type {
    Article,
    ArticleStatus,
    ArticleWithRelations,
} from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

export interface GetArticlesFilters {
    status?: ArticleStatus | 'ALL';
    pillarId?: string | null;
    productId?: string | null;
    search?: string;
    limit?: number;
    offset?: number;
}

export const articleService = {
    async getArticles(
        workspaceId: string,
        filters?: GetArticlesFilters
    ): Promise<ArticleWithRelations[]> {
        let query = supabase
            .from('articles')
            .select(
                `
                *,
                product:products(id, name),
                pillar:pillar_configs(id, pillar, name)
            `
            )
            .eq('workspaceId', workspaceId);

        if (filters?.status && filters.status !== 'ALL') {
            query = query.eq('status', filters.status);
        }

        if (filters?.pillarId) {
            query = query.eq('pillarId', filters.pillarId);
        }

        if (filters?.productId) {
            query = query.eq('productId', filters.productId);
        }

        if (filters?.search) {
            query = query.ilike('title', `%${filters.search}%`);
        }

        query = query
            .order('createdAt', { ascending: false })
            .range(
                filters?.offset ?? 0,
                (filters?.offset ?? 0) + (filters?.limit ?? 20) - 1
            );

        const { data, error } = await query;

        if (error) {
            throw new Error(`Erro ao buscar artigos: ${error.message}`);
        }

        const articles = (data ?? []) as ArticleWithRelations[];

        if (articles.length > 0) {
            const articleIds = articles.map((a) => a.id);
            const counts = await this.getContentPieceCounts(
                workspaceId,
                articleIds
            );

            return articles.map((article) => ({
                ...article,
                _count: { contentPieces: counts[article.id] || 0 },
            }));
        }

        return articles;
    },

    async getContentPieceCounts(
        workspaceId: string,
        articleIds: string[]
    ): Promise<Record<string, number>> {
        const { data, error } = await supabase
            .from('content_pieces')
            .select('articleId')
            .eq('workspaceId', workspaceId)
            .in('articleId', articleIds);

        if (error) {
            console.error('Error fetching content piece counts:', error);
            return {};
        }

        const counts: Record<string, number> = {};
        articleIds.forEach((id) => {
            counts[id] = 0;
        });

        data?.forEach((piece) => {
            if (counts[piece.articleId] !== undefined) {
                counts[piece.articleId]++;
            }
        });

        return counts;
    },

    async getArticle(id: string): Promise<Article | null> {
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar artigo: ${error.message}`);
        }

        return data as Article;
    },

    async getArticleWithRelations(
        id: string
    ): Promise<ArticleWithRelations | null> {
        const { data, error } = await supabase
            .from('articles')
            .select(
                `
                *,
                product:products(id, name),
                pillar:pillar_configs(id, pillar, name)
            `
            )
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar artigo: ${error.message}`);
        }

        if (!data) return null;

        const article = data as ArticleWithRelations;
        const counts = await this.getContentPieceCounts(article.workspaceId, [
            id,
        ]);

        return {
            ...article,
            _count: { contentPieces: counts[id] || 0 },
        };
    },

    async createArticle(
        workspaceId: string,
        input: CreateArticleInput,
        userId?: string
    ): Promise<Article> {
        const id = uuidv4();
        const slug = input.slug || generateSlug(input.title);

        const { data, error } = await supabase
            .from('articles')
            .insert({
                id,
                workspaceId,
                title: input.title,
                slug,
                summary: input.summary || null,
                body: input.body || '',
                pillarId: input.pillarId || null,
                productId: input.productId || null,
                seoTitle: input.seoTitle || null,
                seoDescription: input.seoDescription || null,
                keywords: input.keywords || [],
                status: 'DRAFT',
                aiGenerated: input.aiGenerated || false,
                aiPromptUsed: input.aiPromptUsed || null,
                readingTimeMin: input.readingTimeMin || null,
                createdBy: userId || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Já existe um artigo com este slug');
            }
            throw new Error(`Erro ao criar artigo: ${error.message}`);
        }

        return data as Article;
    },

    async updateArticle(
        id: string,
        input: UpdateArticleInput
    ): Promise<Article> {
        const updateData: Record<string, unknown> = {};

        if (input.title !== undefined) updateData.title = input.title;
        if (input.slug !== undefined) updateData.slug = input.slug;
        if (input.summary !== undefined) updateData.summary = input.summary;
        if (input.body !== undefined) updateData.body = input.body;
        if (input.pillarId !== undefined) updateData.pillarId = input.pillarId;
        if (input.productId !== undefined)
            updateData.productId = input.productId;
        if (input.seoTitle !== undefined) updateData.seoTitle = input.seoTitle;
        if (input.seoDescription !== undefined)
            updateData.seoDescription = input.seoDescription;
        if (input.keywords !== undefined) updateData.keywords = input.keywords;
        if (input.status !== undefined) {
            updateData.status = input.status;
            if (input.status === 'PUBLISHED') {
                updateData.publishedAt = new Date().toISOString();
            }
        }
        if (input.publishedUrl !== undefined)
            updateData.publishedUrl = input.publishedUrl;
        if (input.aiPromptUsed !== undefined)
            updateData.aiPromptUsed = input.aiPromptUsed;
        if (input.readingTimeMin !== undefined)
            updateData.readingTimeMin = input.readingTimeMin;

        updateData.updatedAt = new Date().toISOString();

        const { data, error } = await supabase
            .from('articles')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Já existe um artigo com este slug');
            }
            throw new Error(`Erro ao atualizar artigo: ${error.message}`);
        }

        return data as Article;
    },

    async deleteArticle(id: string): Promise<void> {
        const { error } = await supabase.from('articles').delete().eq('id', id);

        if (error) {
            throw new Error(`Erro ao eliminar artigo: ${error.message}`);
        }
    },

    async duplicateArticle(id: string): Promise<Article> {
        const original = await this.getArticle(id);

        if (!original) {
            throw new Error('Artigo não encontrado');
        }

        const newSlug = `${original.slug}-copy-${Date.now()}`;

        const { data, error } = await supabase
            .from('articles')
            .insert({
                id: uuidv4(),
                workspaceId: original.workspaceId,
                title: `${original.title} (cópia)`,
                slug: newSlug,
                summary: original.summary,
                body: original.body,
                pillarId: original.pillarId,
                productId: original.productId,
                seoTitle: original.seoTitle,
                seoDescription: original.seoDescription,
                keywords: original.keywords,
                status: 'DRAFT',
                aiGenerated: false,
                createdBy: original.createdBy,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao duplicar artigo: ${error.message}`);
        }

        return data as Article;
    },

    async updateStatus(id: string, status: ArticleStatus): Promise<Article> {
        return this.updateArticle(id, {
            status,
            ...(status === 'PUBLISHED'
                ? { publishedAt: new Date().toISOString() }
                : {}),
        });
    },
};

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .substring(0, 100);
}
