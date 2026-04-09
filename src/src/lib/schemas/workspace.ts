import { z } from 'zod';

const sectorOptions = [
    'SaaS',
    'Consultoria',
    'E-commerce',
    'Marketing Digital',
    'Tecnologia',
    'Finanças',
    'Saúde',
    'Educação',
    'Imobiliário',
    'Restaurantes',
    'Retail',
    'Outro',
] as const;

const languageOptions = [
    { value: 'pt', label: 'Português' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
] as const;

export const createWorkspaceSchema = z.object({
    name: z
        .string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome demasiado longo'),
    description: z.string().max(500, 'Descrição demasiado longa').optional(),
    sector: z.string().min(1, 'Selecione um sector'),
    website: z.string().url('URL inválida').optional().or(z.literal('')),
    voiceTone: z.string().max(500, 'Tom de voz demasiado longo').optional(),
    targetAudience: z
        .string()
        .max(500, 'Público-alvo demasiado longo')
        .optional(),
    valueProposition: z
        .string()
        .max(1000, 'Proposta de valor demasiado longa')
        .optional(),
    contentLanguage: z.string().default('pt'),
    valueRatio: z.number().min(0).max(100).default(70),
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial();

export type CreateWorkspaceFormData = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceFormData = z.infer<typeof updateWorkspaceSchema>;
export type Sector = (typeof sectorOptions)[number];
export type Language = (typeof languageOptions)[number]['value'];

export const SECTOR_OPTIONS = sectorOptions;
export const LANGUAGE_OPTIONS = languageOptions;
