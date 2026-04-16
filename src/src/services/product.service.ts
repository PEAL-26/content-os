import type {
    CreateProductInput,
    UpdateProductInput,
} from '@/lib/schemas/product';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

export const productService = {
    async getProducts(workspaceId: string): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('workspaceId', workspaceId)
            .order('createdAt', { ascending: false });

        if (error) {
            throw new Error(`Erro ao buscar produtos: ${error.message}`);
        }

        return (data ?? []) as Product[];
    },

    async getActiveProducts(workspaceId: string): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('workspaceId', workspaceId)
            .eq('isActive', true)
            .order('createdAt', { ascending: false });

        if (error) {
            throw new Error(`Erro ao buscar produtos ativos: ${error.message}`);
        }

        return (data ?? []) as Product[];
    },

    async getProduct(id: string): Promise<Product | null> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar produto: ${error.message}`);
        }

        return data as Product;
    },

    async createProduct(
        workspaceId: string,
        input: CreateProductInput
    ): Promise<Product> {
        const id = uuidv4();

        const { data, error } = await supabase
            .from('products')
            .insert({
                id,
                workspaceId,
                name: input.name,
                slug: input.slug,
                description: input.description || null,
                tagline: input.tagline || null,
                landingUrl: input.landingUrl || null,
                demoUrl: input.demoUrl || null,
                targetAudience: input.targetAudience || null,
                problemSolved: input.problemSolved || null,
                isActive: input.isActive ?? true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Já existe um produto com este slug');
            }
            throw new Error(`Erro ao criar produto: ${error.message}`);
        }

        return data as Product;
    },

    async updateProduct(
        id: string,
        input: UpdateProductInput
    ): Promise<Product> {
        const { data, error } = await supabase
            .from('products')
            .update({
                name: input.name,
                slug: input.slug,
                description: input.description ?? null,
                tagline: input.tagline ?? null,
                landingUrl: input.landingUrl ?? null,
                demoUrl: input.demoUrl ?? null,
                targetAudience: input.targetAudience ?? null,
                problemSolved: input.problemSolved ?? null,
                isActive: input.isActive,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Já existe um produto com este slug');
            }
            throw new Error(`Erro ao atualizar produto: ${error.message}`);
        }

        return data as Product;
    },

    async toggleActive(id: string): Promise<Product> {
        const product = await this.getProduct(id);

        if (!product) {
            throw new Error('Produto não encontrado');
        }

        const { data, error } = await supabase
            .from('products')
            .update({
                isActive: !product.isActive,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(
                `Erro ao alternar estado do produto: ${error.message}`
            );
        }

        return data as Product;
    },

    generateSlug(name: string): string {
        const base = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

        return base;
    },
};
