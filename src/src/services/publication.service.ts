import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import type {
    ContentPublication,
    PublicationTargetType,
} from '@/types/database';

// =============================================================================
// CONTENT PUBLICATIONS (multi-plataforma, polimórfico ARTICLE|PIECE|VIDEO_SCRIPT)
// + helper de assets (upload Storage 'assets' ou link externo).
// =============================================================================

export type PublicationPlatform = string; // 'LINKEDIN' | 'INSTAGRAM' | 'outros' | ...

export interface CreatePublicationInput {
    targetType: PublicationTargetType;
    targetId: string;
    platform: string;
    url: string;
    publishedAt?: string;
}

export const publicationService = {
    async getPublications(
        targetType: PublicationTargetType,
        targetId: string
    ): Promise<ContentPublication[]> {
        const { data, error } = await supabase
            .from('content_publications')
            .select('*')
            .eq('targetType', targetType)
            .eq('targetId', targetId)
            .order('publishedAt', { ascending: false });

        if (error) {
            throw new Error(
                `Erro ao buscar publicações: ${error.message}`
            );
        }

        return (data ?? []) as ContentPublication[];
    },

    /** Cria uma publicação (permite múltiplas por target). */
    async createPublication(
        input: CreatePublicationInput
    ): Promise<ContentPublication> {
        const { data, error } = await supabase
            .from('content_publications')
            .insert({
                id: uuidv4(),
                targetType: input.targetType,
                targetId: input.targetId,
                platform: input.platform,
                url: input.url,
                publishedAt: input.publishedAt ?? new Date().toISOString(),
                createdAt: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao criar publicação: ${error.message}`);
        }

        return data as ContentPublication;
    },

    async deletePublication(id: string): Promise<void> {
        const { error } = await supabase
            .from('content_publications')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Erro ao remover publicação: ${error.message}`);
        }
    },
};

// -----------------------------------------------------------------------------
// Assets — upload para o bucket 'assets' (supabase.storage)
// -----------------------------------------------------------------------------

export interface AssetUpload {
    url: string;
    name: string;
}

/**
 * Faz upload de um ficheiro para o bucket "assets" e devolve
 * { url (publica), name }. Usado pelos fluxos de "marcar publicado".
 */
export async function uploadAsset(
    file: File,
    folder: string
): Promise<AssetUpload> {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const safeName = `${folder}/${Date.now()}-${file.name
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .slice(0, 80)}`;
    const path = extension ? `${safeName}` : `${safeName}`;

    const { error } = await supabase.storage
        .from('assets')
        .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        throw new Error(`Erro ao carregar artefacto: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
        .from('assets')
        .getPublicUrl(path);

    return {
        url: publicUrlData.publicUrl,
        name: file.name,
    };
}