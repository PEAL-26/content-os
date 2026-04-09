import { z } from 'zod';

export const loginSchema = z.object({
    email: z.email('Email inválido').min(1, 'Email é obrigatório'),
    password: z
        .string()
        .min(1, 'Password é obrigatória')
        .min(6, 'Password deve ter pelo menos 6 caracteres'),
});

export const registerSchema = z
    .object({
        name: z
            .string()
            .min(2, 'Nome deve ter pelo menos 2 caracteres')
            .max(100, 'Nome demasiado longo'),
        email: z.email('Email inválido').min(1, 'Email é obrigatório'),
        password: z
            .string()
            .min(1, 'Password é obrigatória')
            .min(6, 'Password deve ter pelo menos 6 caracteres'),
        confirmPassword: z
            .string()
            .min(1, 'Confirmação de password é obrigatória'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'As passwords não coincidem',
        path: ['confirmPassword'],
    });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
