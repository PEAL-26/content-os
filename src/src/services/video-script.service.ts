import { supabase } from '@/lib/supabase';
import type { ArticleStatus, SocialChannel } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

export interface VideoScript {
    id: string;
    articleId: string;
    workspaceId: string;
    title: string;
    hook: string;
    problem: string | null;
    solution: string | null;
    cta: string;
    fullScript: string;
    durationSec: number;
    targetChannel: SocialChannel;
    onScreenText: string[];
    bRoll: string[];
    status: ArticleStatus;
    aiGenerated: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface VideoScriptWithRelations extends VideoScript {
    article?: { id: string; title: string };
}

export interface CreateVideoScriptInput {
    articleId: string;
    workspaceId: string;
    title: string;
    hook: string;
    problem?: string | null;
    solution?: string | null;
    cta: string;
    fullScript: string;
    durationSec?: number;
    targetChannel: SocialChannel;
    onScreenText?: string[];
    bRoll?: string[];
    aiGenerated?: boolean;
}

export interface UpdateVideoScriptInput {
    title?: string;
    hook?: string;
    problem?: string | null;
    solution?: string | null;
    cta?: string;
    fullScript?: string;
    durationSec?: number;
    targetChannel?: SocialChannel;
    onScreenText?: string[];
    bRoll?: string[];
    status?: ArticleStatus;
}

export interface VideoScriptsFilters {
    articleId?: string;
    targetChannel?: SocialChannel;
    status?: ArticleStatus;
}

export const videoScriptService = {
    async getVideoScripts(
        workspaceId: string,
        filters?: VideoScriptsFilters
    ): Promise<VideoScriptWithRelations[]> {
        let query = supabase
            .from('video_scripts')
            .select(
                `
                *,
                article:articles(id, title)
            `
            )
            .eq('workspaceId', workspaceId)
            .order('createdAt', { ascending: false });

        if (filters?.articleId) {
            query = query.eq('articleId', filters.articleId);
        }

        if (filters?.targetChannel) {
            query = query.eq('targetChannel', filters.targetChannel);
        }

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(
                `Erro ao buscar roteiros de vídeo: ${error.message}`
            );
        }

        return (data || []) as VideoScriptWithRelations[];
    },

    async getVideoScript(
        id: string
    ): Promise<VideoScriptWithRelations | null> {
        const { data, error } = await supabase
            .from('video_scripts')
            .select(
                `
                *,
                article:articles(id, title)
            `
            )
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(
                `Erro ao buscar roteiro de vídeo: ${error.message}`
            );
        }

        return data as VideoScriptWithRelations;
    },

    async createVideoScript(
        input: CreateVideoScriptInput
    ): Promise<VideoScript> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('video_scripts')
            .insert({
                id,
                articleId: input.articleId,
                workspaceId: input.workspaceId,
                title: input.title,
                hook: input.hook,
                problem: input.problem || null,
                solution: input.solution || null,
                cta: input.cta,
                fullScript: input.fullScript,
                durationSec: input.durationSec || 60,
                targetChannel: input.targetChannel,
                onScreenText: input.onScreenText || [],
                bRoll: input.bRoll || [],
                status: 'DRAFT',
                aiGenerated: input.aiGenerated || false,
                createdAt: now,
                updatedAt: now,
            })
            .select()
            .single();

        if (error) {
            throw new Error(
                `Erro ao criar roteiro de vídeo: ${error.message}`
            );
        }

        return data as VideoScript;
    },

    async updateVideoScript(
        id: string,
        input: UpdateVideoScriptInput
    ): Promise<VideoScript> {
        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };

        if (input.title !== undefined) updateData.title = input.title;
        if (input.hook !== undefined) updateData.hook = input.hook;
        if (input.problem !== undefined) updateData.problem = input.problem;
        if (input.solution !== undefined) updateData.solution = input.solution;
        if (input.cta !== undefined) updateData.cta = input.cta;
        if (input.fullScript !== undefined) updateData.fullScript = input.fullScript;
        if (input.durationSec !== undefined) updateData.durationSec = input.durationSec;
        if (input.targetChannel !== undefined) updateData.targetChannel = input.targetChannel;
        if (input.onScreenText !== undefined) updateData.onScreenText = input.onScreenText;
        if (input.bRoll !== undefined) updateData.bRoll = input.bRoll;
        if (input.status !== undefined) updateData.status = input.status;

        const { data, error } = await supabase
            .from('video_scripts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(
                `Erro ao atualizar roteiro de vídeo: ${error.message}`
            );
        }

        return data as VideoScript;
    },

    async updateStatus(
        id: string,
        status: ArticleStatus
    ): Promise<VideoScript> {
        const { data, error } = await supabase
            .from('video_scripts')
            .update({
                status,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao atualizar status: ${error.message}`);
        }

        return data as VideoScript;
    },

    async deleteVideoScript(id: string): Promise<void> {
        const { error } = await supabase
            .from('video_scripts')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(
                `Erro ao eliminar roteiro de vídeo: ${error.message}`
            );
        }
    },
};
