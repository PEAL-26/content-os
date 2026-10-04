import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import type { ContentPublication, PublicationTargetType } from '@/types/database';

// =============================================================================
// CONTENT PUBLICATIONS (multi-plataforma, polimórfico ARTICLE|PIECE|VIDEO_SCRIPT)
// O upload de artefactos e o registo em content_assets vivem em
// content-asset.service.ts (o wrapper `uploadAsset` que cá existia foi
// removido: o planeador importa `uploadAssetFile` diretamente).
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