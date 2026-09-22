import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { v4 as uuidv4 } from 'uuid';
import type { AIProviderConfigOptions } from '@/lib/ai/types';

// =============================================================================
// Types
// =============================================================================

export interface AIProviderModel {
    id: string;
    providerId: string;
    displayName: string;
    modelCode: string;
    /** Configuração padrão do modelo (temperature, max_tokens, ...). */
    config?: AIProviderConfigOptions | null;
    isActive: boolean;
    createdAt: string;
}

export interface AIProviderHeader {
    id: string;
    providerId: string;
    key: string;
    value: string;
    createdAt: string;
}

export interface AIProvider {
    id: string;
    providerId: string;
    name: string;
    description: string | null;
    baseUrl: string | null;
    /** Dono a nível de utilizador (acessível em todos os workspaces dele). */
    userId?: string | null;
    /** Workspace específico (só membros desse workspace). */
    workspaceId?: string | null;
    /** API key cifrada (AES-GCM, chave derivada da password). */
    apiKeyEncrypted?: string | null;
    /** IV (base64) usado na cifra da API key. */
    apiKeyIv?: string | null;
    /** Configuração padrão do provider (temperature, max_tokens, ...). */
    config?: AIProviderConfigOptions | null;
    isDefault: boolean;
    isCustom: boolean;
    isActive: boolean;
    priority: number;
    createdAt: string;
    updatedAt: string;
    models: AIProviderModel[];
    headers: AIProviderHeader[];
}

/** Scope onde um provider vive. */
export type ProviderScope =
    | { type: 'user' }
    | { type: 'workspace'; workspaceId: string };

export interface CreateCustomProviderInput {
    name: string;
    baseUrl: string;
    description?: string;
    config?: AIProviderConfigOptions | null;
    models: { displayName: string; modelCode: string; config?: AIProviderConfigOptions | null }[];
    headers?: { key: string; value: string }[];
}

export interface UpdateProviderInput {
    name?: string;
    baseUrl?: string;
    description?: string;
    config?: AIProviderConfigOptions | null;
    isActive?: boolean;
    models?: { displayName: string; modelCode: string; config?: AIProviderConfigOptions | null }[];
    headers?: { key: string; value: string }[];
}

// =============================================================================
// Scope helpers
// =============================================================================

function getCurrentUserId(): string | null {
    return useAuthStore.getState().user?.id ?? null;
}

/** Ids dos workspaces onde o utilizador atual é membro (sem duplicados). */
async function getMyWorkspaceIds(): Promise<string[]> {
    const uid = getCurrentUserId();
    if (!uid) return [];

    const { data, error } = await supabase
        .from('workspace_members')
        .select('workspaceId')
        .eq('userId', uid);

    if (error) {
        throw new Error(`Erro ao buscar workspaces: ${error.message}`);
    }

    return Array.from(new Set((data ?? []).map((r) => r.workspaceId as string)));
}

/**
 * Devolve o scope donde o provider é visível para o utilizador atual:
 * user-level (dono) ou workspace (membro). Usado pela UI para agrupar.
 */
export function getProviderScope(p: AIProvider): ProviderScope | null {
    const uid = getCurrentUserId();
    if (p.userId && p.userId === uid) return { type: 'user' };
    if (p.workspaceId) return { type: 'workspace', workspaceId: p.workspaceId };
    return null;
}

/** true se o utilizador atual é OWNER do workspace (configura providers de workspace). */
export async function isWorkspaceOwner(workspaceId: string): Promise<boolean> {
    const uid = getCurrentUserId();
    if (!uid) return false;

    const { data, error } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspaceId', workspaceId)
        .eq('userId', uid)
        .single();

    if (error) return false;
    return data?.role === 'OWNER';
}

// =============================================================================
// Default Provider Configs (for seeding)
// =============================================================================

interface DefaultProviderConfig {
    providerId: string;
    name: string;
    description: string;
    baseUrl?: string;
    priority: number;
    models: { displayName: string; modelCode: string }[];
}

export const DEFAULT_AI_PROVIDERS: DefaultProviderConfig[] = [
    {
        providerId: 'anthropic',
        name: 'Anthropic Claude',
        description: 'Modelo mais capaz, ideal para tarefas complexas',
        baseUrl: 'https://api.anthropic.com/v1/',
        priority: 1,
        models: [
            { displayName: 'Claude Sonnet 4', modelCode: 'claude-sonnet-4-20250514' },
            { displayName: 'Claude Haiku 4', modelCode: 'claude-haiku-4-20250514' },
        ],
    },
    {
        providerId: 'openai',
        name: 'OpenAI GPT',
        description: 'Excelente equilíbrio entre custo e qualidade',
        baseUrl: 'https://api.openai.com/v1',
        priority: 2,
        models: [
            { displayName: 'GPT-4o', modelCode: 'gpt-4o' },
            { displayName: 'GPT-4o Mini', modelCode: 'gpt-4o-mini' },
        ],
    },
    {
        providerId: 'google',
        name: 'Google Gemini',
        description: 'Gratuito com bons limites, muito rápido',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        priority: 3,
        models: [
            { displayName: 'Gemini 2.0 Flash', modelCode: 'gemini-2.0-flash' },
            { displayName: 'Gemini 1.5 Flash', modelCode: 'gemini-1.5-flash' },
        ],
    },
    {
        providerId: 'opencode',
        name: 'OpenCode Zen',
        description: '1M tokens gratuito',
        baseUrl: 'https://opencode.ai/zen/v1',
        priority: 4,
        models: [
            { displayName: 'Big Pickle', modelCode: 'big-pickle' },
            { displayName: 'Nemotron 3 Super Free', modelCode: 'nemotron-3-super-free' },
        ],
    },
    {
        providerId: 'groq',
        name: 'Groq',
        description: 'Mais rápido, 30 RPM gratuito',
        baseUrl: 'https://api.groq.com/openai/v1',
        priority: 5,
        models: [
            { displayName: 'Llama 3.3 70B', modelCode: 'llama-3.3-70b-versatile' },
            { displayName: 'Llama 3.1 8B Instant', modelCode: 'llama-3.1-8b-instant' },
        ],
    },
    {
        providerId: 'deepseek',
        name: 'DeepSeek',
        description: 'Muito barato, bom para tarefas simples',
        baseUrl: 'https://api.deepseek.com/v1',
        priority: 6,
        models: [
            { displayName: 'DeepSeek Chat', modelCode: 'deepseek-chat' },
            { displayName: 'DeepSeek Reasoner', modelCode: 'deepseek-reasoner' },
        ],
    },
    {
        providerId: 'cerebras',
        name: 'Cerebras',
        description: '1M tokens gratuitos por mês',
        baseUrl: 'https://api.cerebras.ai/v1',
        priority: 7,
        models: [
            { displayName: 'Llama 3.3 70B', modelCode: 'llama3.3-70b' },
            { displayName: 'Qwen 3 32B', modelCode: 'qwen-3-32b' },
        ],
    },
    {
        providerId: 'together',
        name: 'Together AI',
        description: 'Bom tier gratuito, vários modelos open source',
        baseUrl: 'https://api.together.xyz/v1',
        priority: 8,
        models: [
            { displayName: 'Llama 3.3 70B Turbo', modelCode: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
            { displayName: 'Mixtral 8x22B', modelCode: 'mistralai/Mixtral-8x22B-Instruct-v0.1' },
        ],
    },
    {
        providerId: 'openrouter',
        name: 'OpenRouter',
        description: 'Unified API para 300+ modelos',
        baseUrl: 'https://openrouter.ai/api/v1',
        priority: 9,
        models: [
            { displayName: 'Claude 3.5 Haiku', modelCode: 'anthropic/claude-3.5-haiku' },
            { displayName: 'Gemini 2.0 Flash', modelCode: 'google/gemini-2.0-flash' },
        ],
    },
    {
        providerId: 'nvidia',
        name: 'NVIDIA Inkling',
        description: 'Thinking Machines Lab — Inkling via NVIDIA API (self-hosted)',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        priority: 11,
        models: [
            { displayName: 'Inkling v1.0', modelCode: 'thinkingmachines/inkling' },
        ],
    },
    {
        providerId: 'ollama',
        name: 'Ollama (Local)',
        description: 'Modelos locais no teu computador',
        baseUrl: 'http://localhost:11434/v1',
        priority: 10,
        models: [
            { displayName: 'Gemma 3 4B', modelCode: 'gemma3:4b' },
            { displayName: 'Mistral', modelCode: 'mistral' },
        ],
    },
];

// =============================================================================
// Service
// =============================================================================

export const aiProviderService = {
    /**
     * Lista os provedores visíveis para o utilizador atual: os seus user-level
     * + os de cada workspace onde é membro. A BD aplica RLS por `auth.uid()`.
     */
    async getProviders(): Promise<AIProvider[]> {
        const uid = getCurrentUserId();
        if (!uid) return [];

        const workspaceIds = await getMyWorkspaceIds();

        let query = supabase
            .from('ai_providers')
            .select(`
                *,
                models:ai_provider_models(*),
                headers:ai_provider_headers(*)
            `);

        // Filtro explícito além da RLS (defesa em profundidade): os do
        // utilizador + os dos workspaces onde é membro.
        if (workspaceIds.length > 0) {
            query = query.or(
                `userId.eq.${uid},workspaceId.in.(${workspaceIds.join(',')})`
            );
        } else {
            query = query.eq('userId', uid);
        }

        const { data, error } = await query.order('priority');

        if (error) {
            throw new Error(`Erro ao buscar provedores: ${error.message}`);
        }

        return (data ?? []) as AIProvider[];
    },

    async getProviderById(id: string): Promise<AIProvider | null> {
        const { data, error } = await supabase
            .from('ai_providers')
            .select(`
                *,
                models:ai_provider_models(*),
                headers:ai_provider_headers(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Erro ao buscar provedor: ${error.message}`);
        }

        return data as AIProvider;
    },

    /**
     * Devolve o provedor padrão configurado no workspace (row id) + modelo.
     */
    async getDefaultProviderConfig(workspaceId: string): Promise<{
        providerId: string;
        modelCode: string | null;
    } | null> {
        const { data: workspace, error: wsError } = await supabase
            .from('workspaces')
            .select('defaultAIProviderId, defaultAIModel')
            .eq('id', workspaceId)
            .single();

        if (wsError || !workspace?.defaultAIProviderId) return null;

        return {
            providerId: workspace.defaultAIProviderId,
            modelCode: workspace.defaultAIModel,
        };
    },

    async setDefaultProvider(
        workspaceId: string,
        providerId: string,
        modelCode: string
    ): Promise<void> {
        const { error } = await supabase
            .from('workspaces')
            .update({
                defaultAIProviderId: providerId,
                defaultAIModel: modelCode,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', workspaceId);

        if (error) {
            throw new Error(`Erro ao definir provedor padrão: ${error.message}`);
        }
    },

    async createCustomProvider(
        input: CreateCustomProviderInput,
        scope: ProviderScope = { type: 'user' }
    ): Promise<AIProvider> {
        const providerId = `custom_${uuidv4().slice(0, 8)}`;
        const uid = getCurrentUserId();

        // Prioridade: max dentro do scope do dono + 1 (user-level e
        // workspace-level têm filas de prioridade independentes por scope).
        const existing = await this.getProviders();
        const maxPriority = existing.reduce(
            (max, p) => Math.max(max, p.priority),
            0
        );

        const insertData: Record<string, unknown> = {
            id: uuidv4(),
            providerId,
            name: input.name,
            description: input.description ?? null,
            baseUrl: input.baseUrl,
            config: input.config ?? null,
            isDefault: false,
            isCustom: true,
            isActive: true,
            priority: maxPriority + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (scope.type === 'user') {
            insertData.userId = uid;
            insertData.workspaceId = null;
        } else {
            insertData.userId = null;
            insertData.workspaceId = scope.workspaceId;
        }

        const { data: provider, error: providerError } = await supabase
            .from('ai_providers')
            .insert(insertData)
            .select()
            .single();

        if (providerError) {
            throw new Error(`Erro ao criar provedor: ${providerError.message}`);
        }

        // Insert models
        if (input.models.length > 0) {
            const modelsToInsert = input.models.map((m) => ({
                id: uuidv4(),
                providerId: provider.id,
                displayName: m.displayName,
                modelCode: m.modelCode,
                config: m.config ?? null,
                isActive: true,
                createdAt: new Date().toISOString(),
            }));

            const { error: modelsError } = await supabase
                .from('ai_provider_models')
                .insert(modelsToInsert);

            if (modelsError) {
                throw new Error(`Erro ao criar modelos: ${modelsError.message}`);
            }
        }

        // Insert headers
        if (input.headers && input.headers.length > 0) {
            const headersToInsert = input.headers.map((h) => ({
                id: uuidv4(),
                providerId: provider.id,
                key: h.key,
                value: h.value,
                createdAt: new Date().toISOString(),
            }));

            const { error: headersError } = await supabase
                .from('ai_provider_headers')
                .insert(headersToInsert);

            if (headersError) {
                throw new Error(`Erro ao criar headers: ${headersError.message}`);
            }
        }

        return this.getProviderById(provider.id) as Promise<AIProvider>;
    },

    async updateProvider(
        providerId: string,
        input: UpdateProviderInput
    ): Promise<AIProvider> {
        // Update provider fields
        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };

        if (input.name !== undefined) updateData.name = input.name;
        if (input.baseUrl !== undefined) updateData.baseUrl = input.baseUrl;
        if (input.description !== undefined)
            updateData.description = input.description;
        if (input.config !== undefined) updateData.config = input.config;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        const { error: providerError } = await supabase
            .from('ai_providers')
            .update(updateData)
            .eq('id', providerId);

        if (providerError) {
            throw new Error(
                `Erro ao atualizar provedor: ${providerError.message}`
            );
        }

        // Replace models if provided
        if (input.models !== undefined) {
            // Delete existing models
            await supabase
                .from('ai_provider_models')
                .delete()
                .eq('providerId', providerId);

            // Insert new models
            if (input.models.length > 0) {
                const modelsToInsert = input.models.map((m) => ({
                    id: uuidv4(),
                    providerId,
                    displayName: m.displayName,
                    modelCode: m.modelCode,
                    config: m.config ?? null,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                }));

                const { error: modelsError } = await supabase
                    .from('ai_provider_models')
                    .insert(modelsToInsert);

                if (modelsError) {
                    throw new Error(
                        `Erro ao atualizar modelos: ${modelsError.message}`
                    );
                }
            }
        }

        // Replace headers if provided
        if (input.headers !== undefined) {
            // Delete existing headers
            await supabase
                .from('ai_provider_headers')
                .delete()
                .eq('providerId', providerId);

            // Insert new headers
            if (input.headers.length > 0) {
                const headersToInsert = input.headers.map((h) => ({
                    id: uuidv4(),
                    providerId,
                    key: h.key,
                    value: h.value,
                    createdAt: new Date().toISOString(),
                }));

                const { error: headersError } = await supabase
                    .from('ai_provider_headers')
                    .insert(headersToInsert);

                if (headersError) {
                    throw new Error(
                        `Erro ao atualizar headers: ${headersError.message}`
                    );
                }
            }
        }

        return this.getProviderById(providerId) as Promise<AIProvider>;
    },

    async deleteProvider(id: string): Promise<void> {
        const { error } = await supabase
            .from('ai_providers')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Erro ao eliminar provedor: ${error.message}`);
        }
    },

    /**
     * Cria os provedores padrão uma única vez POR UTILIZADOR (user-level).
     * Devolve true se foram criados, false se já existiam.
     */
    async ensureDefaultProviders(): Promise<boolean> {
        const uid = getCurrentUserId();
        if (!uid) return false;

        const { data: existing, error: existingError } = await supabase
            .from('ai_providers')
            .select('id')
            .eq('userId', uid);

        if (existingError) {
            throw new Error(
                `Erro ao verificar provedores padrão: ${existingError.message}`
            );
        }

        if ((existing ?? []).length > 0) return false;

        const providersToInsert = DEFAULT_AI_PROVIDERS.map((dp) => ({
            id: uuidv4(),
            providerId: dp.providerId,
            name: dp.name,
            description: dp.description,
            baseUrl: dp.baseUrl ?? null,
            userId: uid,
            workspaceId: null,
            isDefault: true,
            isCustom: false,
            isActive: true,
            priority: dp.priority,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }));

        const { data: insertedProviders, error: providersError } = await supabase
            .from('ai_providers')
            .insert(providersToInsert)
            .select();

        if (providersError) {
            throw new Error(
                `Erro ao criar provedores padrão: ${providersError.message}`
            );
        }

        // Insert models for each provider
        const allModels: Array<{
            id: string;
            providerId: string;
            displayName: string;
            modelCode: string;
            isActive: boolean;
            createdAt: string;
        }> = [];

        for (const inserted of insertedProviders) {
            const defaultConfig = DEFAULT_AI_PROVIDERS.find(
                (dp) => dp.providerId === inserted.providerId
            );

            if (defaultConfig) {
                for (const model of defaultConfig.models) {
                    allModels.push({
                        id: uuidv4(),
                        providerId: inserted.id,
                        displayName: model.displayName,
                        modelCode: model.modelCode,
                        isActive: true,
                        createdAt: new Date().toISOString(),
                    });
                }
            }
        }

        if (allModels.length > 0) {
            const { error: modelsError } = await supabase
                .from('ai_provider_models')
                .insert(allModels);

            if (modelsError) {
                throw new Error(
                    `Erro ao criar modelos padrão: ${modelsError.message}`
                );
            }
        }

        return true;
    },
};