import {
    aiProviderService,
    type AIProvider,
    type CreateCustomProviderInput,
    type UpdateProviderInput,
} from '@/services/ai-provider.service';
import { aiProviderKeyService } from '@/services/ai-provider-key.service';
import { pickModel, providerHeadersToRecord } from '@/lib/ai/provider';
import { resolveProviderConfig } from '@/lib/ai/resolver';
import { testLLM } from '@/lib/ai/transport';
import { create } from 'zustand';

interface AIProviderState {
    providers: AIProvider[];
    defaultProviderId: string | null;
    defaultModelCode: string | null;
    /** Chaves por row id (provider.id) — sempre disponíveis (sem password). */
    apiKeys: Record<string, string>;
    /** true quando carregado — as chaves ficam logo acessíveis. */
    isUnlocked: boolean;
    isLoading: boolean;
    error: string | null;
    /** true quando os provedores da conta já foram carregados nesta sessão. */
    hydrated: boolean;
    /** Workspace usado na última hidratação (para re-hidratar ao trocar). */
    hydratedWorkspaceId: string | null;

    fetchProviders: (workspaceId?: string) => Promise<void>;
    /** Hidrata os provedores uma vez, coalescendo chamadas concorrentes. */
    hydrateProviders: (workspaceId?: string) => Promise<void>;
    /** Mantido por compatibilidade — não requer password. */
    unlock: (password: string) => Promise<{ success: boolean; error?: string }>;
    lock: () => void;
    setDefaultProvider: (
        workspaceId: string,
        providerId: string,
        modelCode: string
    ) => Promise<void>;
    createCustomProvider: (
        input: CreateCustomProviderInput,
        scope?: 'user' | 'workspace',
        /** Workspace onde criar (para scope workspace). Fallback: o último hidratado. */
        workspaceId?: string | null
    ) => Promise<{ success: boolean; error?: string; provider?: AIProvider }>;
    updateProvider: (
        providerId: string,
        input: UpdateProviderInput
    ) => Promise<{ success: boolean; error?: string }>;
    deleteProvider: (
        providerId: string
    ) => Promise<{ success: boolean; error?: string }>;
    /** Guarda a chave de um provider (row id da BD). */
    saveApiKey: (
        providerRowId: string,
        key: string
    ) => Promise<{ success: boolean; error?: string }>;
    removeApiKey: (
        providerRowId: string
    ) => Promise<{ success: boolean; error?: string }>;
    /** Testa a conexão por modelo (chave + modelo) via servidor próprio. */
    testConnection: (
        provider: AIProvider,
        modelCode: string,
        apiKey: string,
        baseUrl?: string | null,
        headers?: { key: string; value: string }[]
    ) => Promise<{ success: boolean; error?: string }>;
}

/** Coalesce de hidratação — evita disparar fetchProviders em duplicado. */
let hydratePromise: Promise<void> | null = null;

/** Migração legacy das chaves — corre uma vez por sessão. */
let legacyMigrated = false;

async function decryptKeys(
    providers: AIProvider[]
): Promise<Record<string, string>> {
    const apiKeys: Record<string, string> = {};
    for (const provider of providers) {
        if (!provider.apiKeyEncrypted) continue;
        const key = await aiProviderKeyService.decryptApiKey(provider);
        if (key) apiKeys[provider.id] = key;
    }
    return apiKeys;
}

export const useAIProviderStore = create<AIProviderState>((set, get) => ({
    providers: [],
    defaultProviderId: null,
    defaultModelCode: null,
    apiKeys: {},
    isUnlocked: false,
    isLoading: false,
    error: null,
    hydrated: false,
    hydratedWorkspaceId: null,

    // Provedores com scope por utilizador/workspace. Este método pode ser
    // chamado por qualquer workspace: os provedores user-level são sempre
    // incluídos; o default lido é o do workspace passado.
    fetchProviders: async (workspaceId?: string) => {
        set({ isLoading: true, error: null });

        try {
            let providers = await aiProviderService.getProviders();

            // Seed por utilizador: cria os provedores padrão na primeira
            // utilização deste utilizador.
            if (providers.length === 0) {
                await aiProviderService.ensureDefaultProviders();
                providers = await aiProviderService.getProviders();
            }

            // Migração das chaves antigas (localStorage) para a BD — best-effort,
            // uma vez por sessão. Depois recarrega para incluir as migradas.
            if (!legacyMigrated) {
                legacyMigrated = true;
                try {
                    await aiProviderKeyService.migrateLegacyKeys(providers);
                    providers = await aiProviderService.getProviders();
                } catch {
                    // best-effort — seguimos com a lista atual
                }
            }

            const apiKeys = await decryptKeys(providers);

            let defaultProviderId: string | null = null;
            let defaultModelCode: string | null = null;
            if (workspaceId) {
                const config =
                    await aiProviderService.getDefaultProviderConfig(
                        workspaceId
                    );
                defaultProviderId = config?.providerId ?? null;
                defaultModelCode = config?.modelCode ?? null;
            }

            set({
                providers,
                apiKeys,
                isUnlocked: true,
                defaultProviderId,
                defaultModelCode,
                isLoading: false,
                hydrated: true,
                hydratedWorkspaceId: workspaceId ?? null,
            });
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar provedores';
            set({ isLoading: false, error });
        }
    },

    // Hidratação única por sessão + por workspace: chamadores concorrentes
    // partilham o mesmo promise. Ao trocar de workspace, re-hidrata (o default
    // muda) sem invalidar a coalescência dentro do mesmo workspace.
    hydrateProviders: (workspaceId?: string) => {
        const nextWorkspaceId = workspaceId ?? null;
        const current = get();

        // Re-hidrata quando o workspace mudou desde a última hidratação.
        if (
            current.hydrated &&
            current.hydratedWorkspaceId !== nextWorkspaceId
        ) {
            set({ hydrated: false });
        }

        if (hydratePromise) return hydratePromise;

        hydratePromise = get()
            .fetchProviders(workspaceId)
            .finally(() => {
                hydratePromise = null;
            });

        return hydratePromise;
    },

    unlock: async () => {
        try {
            // Sem password — recarrega os provedores (e chaves) e fica ativo.
            await get().fetchProviders(get().hydratedWorkspaceId ?? undefined);
            set({ isUnlocked: true, error: null });
            return { success: true };
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar as chaves';
            return { success: false, error };
        }
    },

    lock: () => {
        // Só usado no sign-out: descarta os dados em memória.
        set({
            isUnlocked: false,
            apiKeys: {},
            hydrated: false,
            hydratedWorkspaceId: null,
            providers: [],
        });
    },

    setDefaultProvider: async (
        workspaceId: string,
        providerId: string,
        modelCode: string
    ) => {
        try {
            await aiProviderService.setDefaultProvider(
                workspaceId,
                providerId,
                modelCode
            );
            set({ defaultProviderId: providerId, defaultModelCode: modelCode });
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao definir provedor padrão';
            set({ error });
        }
    },

    createCustomProvider: async (
        input: CreateCustomProviderInput,
        scope: 'user' | 'workspace' = 'user',
        workspaceId?: string | null
    ) => {
        try {
            if (scope === 'workspace') {
                // NUNCA inferir o workspace da hidratação sem garantia: se não
                // vier explícito (workspace atual) nem hidratado, falha com erro
                // em vez de criar silenciosamente como provider pessoal.
                const wsId = workspaceId ?? get().hydratedWorkspaceId;
                if (!wsId) {
                    return {
                        success: false,
                        error: 'Workspace não definido. Seleciona um workspace antes de criar o provedor de workspace.',
                    };
                }
                const provider =
                    await aiProviderService.createCustomProvider(input, {
                        type: 'workspace',
                        workspaceId: wsId,
                    });
                set({ providers: [...get().providers, provider] });
                return { success: true, provider };
            }

            const provider = await aiProviderService.createCustomProvider(
                input,
                { type: 'user' }
            );
            set({ providers: [...get().providers, provider] });
            return { success: true, provider };
        } catch (err) {
            const error =
                err instanceof Error ? err.message : 'Erro ao criar provedor';
            return { success: false, error };
        }
    },

    updateProvider: async (
        providerId: string,
        input: UpdateProviderInput
    ) => {
        try {
            const updated = await aiProviderService.updateProvider(
                providerId,
                input
            );
            set({
                providers: get().providers.map((p) =>
                    p.id === providerId ? updated : p
                ),
            });
            return { success: true };
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao atualizar provedor';
            return { success: false, error };
        }
    },

    deleteProvider: async (providerId: string) => {
        try {
            await aiProviderService.deleteProvider(providerId);
            set({
                providers: get().providers.filter((p) => p.id !== providerId),
            });

            // Se o provedor eliminado era o padrão, limpa a referência
            if (get().defaultProviderId === providerId) {
                set({ defaultProviderId: null, defaultModelCode: null });
            }

            return { success: true };
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao eliminar provedor';
            return { success: false, error };
        }
    },

    saveApiKey: async (providerRowId: string, key: string) => {
        if (!key || !key.trim()) {
            return { success: false, error: 'A API Key não pode estar vazia' };
        }

        try {
            await aiProviderKeyService.saveApiKey(providerRowId, key.trim());
            set({
                apiKeys: { ...get().apiKeys, [providerRowId]: key.trim() },
            });
            return { success: true };
        } catch (err) {
            const error =
                err instanceof Error ? err.message : 'Erro ao guardar a chave';
            return { success: false, error };
        }
    },

    removeApiKey: async (providerRowId: string) => {
        try {
            await aiProviderKeyService.removeApiKey(providerRowId);
            const newKeys = { ...get().apiKeys };
            delete newKeys[providerRowId];
            set({
                apiKeys: newKeys,
                providers: get().providers.map((p) =>
                    p.id === providerRowId
                        ? { ...p, apiKeyEncrypted: null, apiKeyIv: null }
                        : p
                ),
            });
            return { success: true };
        } catch (err) {
            const error =
                err instanceof Error ? err.message : 'Erro ao eliminar a chave';
            return { success: false, error };
        }
    },

    testConnection: async (
        provider: AIProvider,
        modelCode: string,
        apiKey: string,
        baseUrl?: string | null,
        headers?: { key: string; value: string }[]
    ) => {
        if (!apiKey || apiKey.trim().length === 0) {
            return { success: false, error: 'API Key não pode estar vazia' };
        }
        if (!modelCode) {
            return {
                success: false,
                error: 'Seleciona um modelo para testar a conexão',
            };
        }

        try {
            const modelRow = pickModel(provider, modelCode);
            const resolved = resolveProviderConfig(
                provider,
                modelRow,
                apiKey.trim(),
                baseUrl ? { baseUrl } : undefined
            );

            await testLLM({
                baseUrl: resolved.base_url,
                apiKey: resolved.api_key,
                model: resolved.model,
                headers: providerHeadersToRecord(
                    headers && headers.length > 0
                        ? headers
                        : provider.headers
                ),
            });

            return { success: true };
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao testar conexão';
            return { success: false, error };
        }
    },
}));