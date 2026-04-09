import { supabase } from '@/lib/supabase';
import type {
    Workspace,
    WorkspaceMember,
    WorkspaceWithRole,
} from '@/types/database';
import { v4 as uuidv4 } from 'uuid';
import { pillarService } from './pillar.service';

export type { Workspace, WorkspaceMember, WorkspaceWithRole };

export interface CreateWorkspaceInput {
    name: string;
    description?: string;
    sector?: string;
    website?: string;
    voiceTone?: string;
    targetAudience?: string;
    valueProposition?: string;
    contentLanguage?: string;
    valueRatio?: number;
    productRatio?: number;
}

export interface UpdateWorkspaceInput {
    name?: string;
    description?: string;
    sector?: string;
    website?: string;
    voiceTone?: string;
    targetAudience?: string;
    valueProposition?: string;
    contentLanguage?: string;
    valueRatio?: number;
    productRatio?: number;
    postsPerWeek?: number;
    articlesPerWeek?: number;
}

export const workspaceService = {
    async getWorkspacesByUser(userId: string): Promise<WorkspaceWithRole[]> {
        const { data, error } = await supabase
            .from('workspace_members')
            .select(
                `
                role,
                workspace:workspaces(*)
            `
            )
            .eq('userId', userId);

        if (error) {
            throw new Error(`Erro ao buscar workspaces: ${error.message}`);
        }

        return (data ?? []).map((item) => ({
            ...(item.workspace as unknown as Workspace),
            memberRole: item.role,
        }));
    },

    async getWorkspace(workspaceId: string): Promise<Workspace | null> {
        const { data, error } = await supabase
            .from('workspaces')
            .select('*')
            .eq('id', workspaceId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Erro ao buscar workspace: ${error.message}`);
        }

        return data;
    },

    async createWorkspace(
        userId: string,
        input: CreateWorkspaceInput
    ): Promise<{ workspaceId: string }> {
        const slug = this.generateSlug(input.name);

        const workspaceId = uuidv4();

        const { error: wsError } = await supabase.from('workspaces').insert({
            id: workspaceId,
            name: input.name,
            slug,
            description: input.description,
            sector: input.sector,
            website: input.website,
            voiceTone: input.voiceTone,
            targetAudience: input.targetAudience,
            valueProposition: input.valueProposition,
            contentLanguage: input.contentLanguage ?? 'pt',
            valueRatio: input.valueRatio ?? 70,
            productRatio: input.productRatio ?? 30,
            updatedAt: new Date().toISOString(),
        });

        if (wsError) {
            throw new Error(`Erro ao criar workspace: ${wsError.message}`);
        }

        const memberId = uuidv4();

        const { error: memberError } = await supabase
            .from('workspace_members')
            .insert({
                id: memberId,
                workspaceId,
                userId,
                role: 'OWNER',
            });

        if (memberError) {
            await supabase.from('workspaces').delete().eq('id', workspaceId);
            throw new Error(
                `Erro ao adicionar membro ao workspace: ${memberError.message}`
            );
        }

        try {
            await pillarService.createDefaultPillars(workspaceId);
        } catch (pillarError) {
            console.error('Erro ao criar pilares por defeito:', pillarError);
        }

        return { workspaceId };
    },

    async updateWorkspace(
        workspaceId: string,
        input: UpdateWorkspaceInput
    ): Promise<Workspace> {
        const { data, error } = await supabase
            .from('workspaces')
            .update({
                name: input.name,
                description: input.description,
                sector: input.sector,
                website: input.website,
                voiceTone: input.voiceTone,
                targetAudience: input.targetAudience,
                valueProposition: input.valueProposition,
                contentLanguage: input.contentLanguage,
                valueRatio: input.valueRatio,
                productRatio: input.productRatio,
                postsPerWeek: input.postsPerWeek,
                articlesPerWeek: input.articlesPerWeek,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', workspaceId)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao atualizar workspace: ${error.message}`);
        }

        return data;
    },

    async addMember(
        workspaceId: string,
        userId: string,
        role: 'OWNER' | 'EDITOR' | 'VIEWER' = 'EDITOR'
    ): Promise<WorkspaceMember> {
        const memberId = uuidv4();

        const { data, error } = await supabase
            .from('workspace_members')
            .insert({
                id: memberId,
                workspaceId,
                userId,
                role,
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao adicionar membro: ${error.message}`);
        }

        return data;
    },

    async removeMember(workspaceId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('workspace_members')
            .delete()
            .eq('workspaceId', workspaceId)
            .eq('userId', userId);

        if (error) {
            throw new Error(`Erro ao remover membro: ${error.message}`);
        }
    },

    async getMembers(
        workspaceId: string
    ): Promise<(WorkspaceMember & { userEmail?: string })[]> {
        const { data, error } = await supabase
            .from('workspace_members')
            .select('*')
            .eq('workspaceId', workspaceId);

        if (error) {
            throw new Error(`Erro ao buscar membros: ${error.message}`);
        }

        return data;
    },

    generateSlug(name: string): string {
        const base = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

        const timestamp = Date.now().toString(36);
        return `${base}-${timestamp}`;
    },
};
