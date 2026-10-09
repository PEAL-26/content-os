import { supabase } from '@/lib/supabase';
import type { AssetTargetType, ContentMediaPrompt, MediaModality } from '@/types/database';

// =============================================================================
// CONTENT MEDIA PROMPTS (CRUD do prompt portátil de imagem/áudio/vídeo)
//
// A tabela é polimórfica por `(targetType, targetId)` e NÃO tem FK — à mesma
// modo que `content_assets`. Por isso o cascade tem de ser explícito nos
// serviços que apagam artigos/peças (ver `deleteMediaPromptsForTarget`).
// =============================================================================

export interface ListMediaPromptsFilters {
    targetType: AssetTargetType;
    targetId: string;
    modality?: MediaModality;
}

export interface SaveMediaPromptInput {
    workspaceId: string;
    targetType: AssetTargetType;
    targetId: string;
    modality: MediaModality;
    itemKey: string;
    prompt: string;
    negativePrompt?: string | null;
    aspectRatio?: string | null;
    /** `undefined` = não tocar; `null` = apagar. */
    providerId?: string | null;
    /** `undefined` = não tocar; `null` = apagar. */
    modelCode?: string | null;
}

export const mediaPromptService = {
    async list(
        filters: ListMediaPromptsFilters
    ): Promise<ContentMediaPrompt[]> {
        let query = supabase
            .from('content_media_prompts')
            .select('*')
            .eq('targetType', filters.targetType)
            .eq('targetId', filters.targetId)
            .order('modality', { ascending: true })
            .order('itemKey', { ascending: true });

        if (filters.modality) {
            query = query.eq('modality', filters.modality);
        }

        const { data, error } = await query;
        if (error) {
            throw new Error(`Erro ao carregar prompts de media: ${error.message}`);
        }
        return (data ?? []) as ContentMediaPrompt[];
    },

    /**
     * Grava um prompt, marcando `editedAt` quando o valor muda.
     *
     * O `editedAt` é o que distingue "a IA escreveu isto" de "o utilizador
     * corrigiu isto" — é o que impede um "Repetir" de destruir trabalho manual.
     */
    async save(input: SaveMediaPromptInput): Promise<ContentMediaPrompt> {
        const now = new Date().toISOString();

        const { data: existing, error: readError } = await supabase
            .from('content_media_prompts')
            .select('id, prompt, editedAt')
            .eq('targetType', input.targetType)
            .eq('targetId', input.targetId)
            .eq('modality', input.modality)
            .eq('itemKey', input.itemKey)
            .maybeSingle();

        if (readError) {
            throw new Error(`Erro ao ler o prompt de media: ${readError.message}`);
        }

        // Só marca `editedAt` quando o TEXTO mudou — gravar o mesmo valor de
        // novo marcava um prompt gerado como se o utilizador o tivesse mexido.
        const editedAt =
            existing && existing.prompt !== input.prompt
                ? now
                : (existing?.editedAt ?? null);

        const payload = {
            workspaceId: input.workspaceId,
            targetType: input.targetType,
            targetId: input.targetId,
            modality: input.modality,
            itemKey: input.itemKey,
            prompt: input.prompt,
            negativePrompt: input.negativePrompt ?? null,
            aspectRatio: input.aspectRatio ?? null,
            providerId: input.providerId ?? null,
            modelCode: input.modelCode ?? null,
            editedAt,
        };

        const { data, error } = existing
            ? await supabase
                  .from('content_media_prompts')
                  .update(payload)
                  .eq('id', existing.id)
                  .select()
                  .single()
            : await supabase
                  .from('content_media_prompts')
                  .insert(payload)
                  .select()
                  .single();

        if (error) {
            throw new Error(`Erro ao guardar o prompt de media: ${error.message}`);
        }
        return data as ContentMediaPrompt;
    },

    async remove(
        targetType: AssetTargetType,
        targetId: string,
        modality: MediaModality,
        itemKey: string
    ): Promise<void> {
        const { error } = await supabase
            .from('content_media_prompts')
            .delete()
            .eq('targetType', targetType)
            .eq('targetId', targetId)
            .eq('modality', modality)
            .eq('itemKey', itemKey);

        if (error) {
            throw new Error(`Erro ao apagar o prompt de media: ${error.message}`);
        }
    },
};

/**
 * Apaga todos os prompts de media de um alvo.
 *
 * Chamado pelos serviços de artigo/peça ao apagar — a tabela não tem FK, logo
 * sem isto os prompts ficariam órfãos (e o painel de ilustrações do artigo
 * mostraria prompts de um artigo que já não existe).
 */
export async function deleteMediaPromptsForTarget(
    workspaceId: string,
    targetType: AssetTargetType,
    targetId: string
): Promise<void> {
    const { error } = await supabase
        .from('content_media_prompts')
        .delete()
        .eq('workspaceId', workspaceId)
        .eq('targetType', targetType)
        .eq('targetId', targetId);

    if (error) {
        throw new Error(`Erro ao apagar prompts de media: ${error.message}`);
    }
}