import { z } from 'zod';

export const createArticleSchema = z.object({
    title: z
        .string()
        .min(1, 'Título é obrigatório')
        .max(200, 'Título demasiado longo'),
    slug: z
        .string()
        .min(2, 'Slug é obrigatório')
        .max(200)
        .regex(/^[a-z0-9-]+$/, 'Slug contém caracteres inválidos')
        .optional(),
    summary: z.string().max(500).optional(),
    body: z.string().optional(),
    pillarId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    seoTitle: z.string().max(100).optional(),
    seoDescription: z.string().max(200).optional(),
    keywords: z.array(z.string()).optional(),
    aiGenerated: z.boolean().optional(),
    aiPromptUsed: z.string().optional(),
    readingTimeMin: z.number().optional(),
});

export const updateArticleSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    slug: z
        .string()
        .min(2)
        .max(200)
        .regex(/^[a-z0-9-]+$/)
        .optional(),
    summary: z.string().max(500).optional().nullable(),
    body: z.string().optional(),
    pillarId: z.string().uuid().optional().nullable(),
    productId: z.string().uuid().optional().nullable(),
    seoTitle: z.string().max(100).optional().nullable(),
    seoDescription: z.string().max(200).optional().nullable(),
    keywords: z.array(z.string()).optional(),
    status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED']).optional(),
    publishedUrl: z.string().url().optional().nullable(),
    aiPromptUsed: z.string().optional().nullable(),
    readingTimeMin: z.number().optional().nullable(),
});

export const articleFiltersSchema = z.object({
    status: z
        .enum(['ALL', 'DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'])
        .optional(),
    pillarId: z.string().uuid().optional().nullable(),
    productId: z.string().uuid().optional().nullable(),
    search: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().min(0).optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type ArticleFiltersInput = z.infer<typeof articleFiltersSchema>;
