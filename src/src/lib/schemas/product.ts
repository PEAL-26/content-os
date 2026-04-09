import { z } from 'zod';

export const createProductSchema = z.object({
    name: z
        .string()
        .min(2, 'Nome é obrigatório')
        .max(100, 'Nome demasiado longo'),
    slug: z
        .string()
        .min(2, 'Slug é obrigatório')
        .max(100)
        .regex(/^[a-z0-9-]+$/, 'Slug contém caracteres inválidos'),
    description: z.string().max(500).optional(),
    tagline: z.string().max(150).optional(),
    landingUrl: z.url('URL inválida').optional().or(z.literal('')),
    demoUrl: z.url('URL inválida').optional().or(z.literal('')),
    targetAudience: z.string().max(200).optional(),
    problemSolved: z.string().max(500).optional(),
    isActive: z.boolean(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
