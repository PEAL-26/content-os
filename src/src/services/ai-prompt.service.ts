import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { v4 as uuidv4 } from 'uuid';
import type {
    GenerationPromptTargetType,
} from '@/types/database';

// =============================================================================
// AI SYSTEM PROMPTS (globais por tipo de conteúdo)
// Resolução: workspace → user → default no código.
// =============================================================================

export type SystemPromptScope = 'user' | 'workspace';

function getCurrentUserId(): string | null {
    return useAuthStore.getState().user?.id ?? null;
}

export interface ResolveSystemPromptOptions {
    workspaceId: string;
    /** 'article' | 'CAROUSEL' | 'VIDEO_SCRIPT' | ... */
    contentType: string;
    /** Prompt padrão (em código) usado quando não há override. */
    buildDefault: () => string;
}

/**
 * Devolve o system prompt efetivo para um tipo de conteúdo: override do
 * workspace (ganha), senão do utilizador, senão o default em código.
 */
export async function resolveSystemPrompt(
    options: ResolveSystemPromptOptions
): Promise<string> {
    const { data: wsRow } = await supabase
        .from('ai_system_prompts')
        .select('systemPrompt')
        .eq('workspaceId', options.workspaceId)
        .eq('contentType', options.contentType)
        .maybeSingle();

    if (wsRow?.systemPrompt) return wsRow.systemPrompt;

    const uid = getCurrentUserId();
    if (uid) {
        const { data: userRow } = await supabase
            .from('ai_system_prompts')
            .select('systemPrompt')
            .eq('userId', uid)
            .eq('contentType', options.contentType)
            .maybeSingle();

        if (userRow?.systemPrompt) return userRow.systemPrompt;
    }

    return options.buildDefault();
}

/** Lista os overrides de um scope (para o editor de prompts das definições). */
export async function getSystemPrompts(scope: SystemPromptScope): Promise<
    Array<{
        id: string;
        contentType: string;
        systemPrompt: string;
    }>
> {
    const uid = getCurrentUserId();
    if (!uid) return [];

    const column = scope === 'user' ? 'userId' : 'workspaceId';
    // Para o editor a nível de workspace, sem workspace definido devolve vazio.
    // O chamador passa sempre um workspace no editor de workspace.
    const value =
        scope === 'user' ? uid : null;

    if (value === null) return [];

    const { data, error } = await supabase
        .from('ai_system_prompts')
        .select('id, contentType, systemPrompt')
        .eq(column, value)
        .order('contentType');

    if (error) {
        throw new Error(`Erro ao buscar prompts de IA: ${error.message}`);
    }

    return (data ?? []) as Array<{
        id: string;
        contentType: string;
        systemPrompt: string;
    }>;
}

/** Lista os overrides de sistema de um workspace específico. */
export async function getWorkspaceSystemPrompts(workspaceId: string): Promise<
    Array<{
        id: string;
        contentType: string;
        systemPrompt: string;
    }>
> {
    const { data, error } = await supabase
        .from('ai_system_prompts')
        .select('id, contentType, systemPrompt')
        .eq('workspaceId', workspaceId)
        .order('contentType');

    if (error) {
        throw new Error(`Erro ao buscar prompts de IA: ${error.message}`);
    }

    return (data ?? []) as Array<{
        id: string;
        contentType: string;
        systemPrompt: string;
    }>;
}

/**
 * Grava um override de system prompt para um tipo de conteúdo. Se já existir
 * um override no scope, substitui (UNIQUE scope+contentType); senão cria.
 */
export async function upsertSystemPrompt(input: {
    scope: SystemPromptScope;
    workspaceId?: string;
    contentType: string;
    systemPrompt: string;
}): Promise<void> {
    const uid = getCurrentUserId();
    if (!uid) throw new Error('Sessão expirada. Inicia sessão novamente.');

    if (input.scope === 'user') {
        const existing = await findOverride('userId', uid, input.contentType);
        if (existing) {
            await updateOverride(existing.id, input.systemPrompt);
        } else {
            await insertOverride({
                userId: uid,
                contentType: input.contentType,
                systemPrompt: input.systemPrompt,
            });
        }
        return;
    }

    if (!input.workspaceId) {
        throw new Error('Workspace em falta para o prompt de workspace.');
    }

    const existing = await findOverride(
        'workspaceId',
        input.workspaceId,
        input.contentType
    );
    if (existing) {
        await updateOverride(existing.id, input.systemPrompt);
    } else {
        await insertOverride({
            workspaceId: input.workspaceId,
            contentType: input.contentType,
            systemPrompt: input.systemPrompt,
        });
    }
}

/** Remove um override (volta ao default em código). */
export async function deleteSystemPrompt(input: {
    scope: SystemPromptScope;
    workspaceId?: string;
    contentType: string;
}): Promise<void> {
    const uid = getCurrentUserId();
    if (!uid) return;

    if (input.scope === 'user') {
        const existing = await findOverride('userId', uid, input.contentType);
        if (existing) await deleteOverride(existing.id);
        return;
    }

    if (!input.workspaceId) return;
    const existing = await findOverride(
        'workspaceId',
        input.workspaceId,
        input.contentType
    );
    if (existing) await deleteOverride(existing.id);
}

async function findOverride(
    column: 'userId' | 'workspaceId',
    value: string,
    contentType: string
): Promise<{ id: string } | null> {
    const { data, error } = await supabase
        .from('ai_system_prompts')
        .select('id')
        .eq(column, value)
        .eq('contentType', contentType)
        .maybeSingle();

    if (error) {
        throw new Error(`Erro ao procurar prompt de IA: ${error.message}`);
    }
    return data as { id: string } | null;
}

async function insertOverride(input: {
    userId?: string;
    workspaceId?: string;
    contentType: string;
    systemPrompt: string;
}): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase.from('ai_system_prompts').insert({
        id: uuidv4(),
        userId: input.userId ?? null,
        workspaceId: input.workspaceId ?? null,
        contentType: input.contentType,
        systemPrompt: input.systemPrompt,
        createdAt: now,
        updatedAt: now,
    });

    if (error) {
        throw new Error(`Erro ao gravar prompt de IA: ${error.message}`);
    }
}

async function updateOverride(id: string, systemPrompt: string): Promise<void> {
    const { error } = await supabase
        .from('ai_system_prompts')
        .update({ systemPrompt, updatedAt: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        throw new Error(`Erro ao atualizar prompt de IA: ${error.message}`);
    }
}

async function deleteOverride(id: string): Promise<void> {
    const { error } = await supabase
        .from('ai_system_prompts')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Erro ao remover prompt de IA: ${error.message}`);
    }
}

// =============================================================================
// CONTENT GENERATION PROMPTS (prompt final portátil por item de peça/roteiro)
// =============================================================================

export interface PortablePromptItem {
    itemKey: string; // 'main' | 'slide-1' | 'tweet-3' | ...
    prompt: string;
}

export interface SaveGenerationPromptsInput {
    targetType: GenerationPromptTargetType;
    targetId: string;
    items: PortablePromptItem[];
    providerId?: string | null;
    modelCode?: string | null;
}

/**
 * Guarda (substituindo) os prompts portáteis de uma peça/roteiro. As operações
 * são de "delete + insert" para manter um único conjunto por target.
 */
export async function saveGenerationPrompts(
    input: SaveGenerationPromptsInput
): Promise<void> {
    await supabase
        .from('content_generation_prompts')
        .delete()
        .eq('targetType', input.targetType)
        .eq('targetId', input.targetId);

    if (input.items.length === 0) return;

    const rows = input.items.map((item) => ({
        id: uuidv4(),
        targetType: input.targetType,
        targetId: input.targetId,
        itemKey: item.itemKey,
        prompt: item.prompt,
        providerId: input.providerId ?? null,
        modelCode: input.modelCode ?? null,
        createdAt: new Date().toISOString(),
    }));

    const { error } = await supabase
        .from('content_generation_prompts')
        .insert(rows);

    if (error) {
        throw new Error(
            `Erro ao gravar prompts de geração: ${error.message}`
        );
    }
}

/** Lê os prompts portáteis de uma peça/roteiro. */
export async function getGenerationPrompts(
    targetType: GenerationPromptTargetType,
    targetId: string
): Promise<PortablePromptItem[]> {
    const { data, error } = await supabase
        .from('content_generation_prompts')
        .select('itemKey, prompt')
        .eq('targetType', targetType)
        .eq('targetId', targetId)
        .order('createdAt');

    if (error) {
        throw new Error(`Erro ao buscar prompts de geração: ${error.message}`);
    }

    return (data ?? []) as PortablePromptItem[];
}

/** Remove os prompts portáteis de uma peça/roteiro. */
export async function deleteGenerationPrompts(
    targetType: GenerationPromptTargetType,
    targetId: string
): Promise<void> {
    const { error } = await supabase
        .from('content_generation_prompts')
        .delete()
        .eq('targetType', targetType)
        .eq('targetId', targetId);

    if (error) {
        throw new Error(`Erro ao remover prompts de geração: ${error.message}`);
    }
}