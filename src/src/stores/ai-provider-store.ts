import {
    aiProviderService,
    type AIProvider,
    type CreateCustomProviderInput,
    type UpdateProviderInput,
} from '@/services/ai-provider.service';
import { aiProviderKeyService } from '@/services/ai-provider-key.service';
import { useAuthStore } from '@/stores/auth-store';
import { pickModel, providerHeadersToRecord } from '@/lib/ai/provider';
import { resolveProviderConfig } from '@/lib/ai/resolver';
import { testLLM } from '@/lib/ai/transport';
import { create } from 'zustand';

interface AIProviderState {
    providers: AIProvider[];
    defaultProviderId: string | null;
    defaultModelCode: string | null;
    /** Chaves descifradas por row id (provider.id) — apenas em memória. */
    apiKeys: Record<string, string>;
    /** true quando a chave mestra (derivada da password) está ativa na sessão. */
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
    unlock: (password: string) => Promise<{ success: boolean; error?: string }>;
    lock: () => void;
    setDefaultProvider: (
        workspaceId: string,
        providerId: string,
        modelCode: string
    ) => Promise<void>;
    createCustomProvider: (
        input: CreateCustomProviderInput,
        scope?: 'user' | 'workspace'
    ) => Promise<{ success: boolean; error?: string; provider?: AIProvider }>;
    updateProvider: (
        providerId: string,
        input: UpdateProviderInput
    ) => Promise<{ success: boolean; error?: string }>;
    deleteProvider: (
        providerId: string
    ) => Promise<{ success: boolean; error?: string }>;
    /** Cifra e persiste a chave de um provider (row id da BD). */
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

function getCurrentUserId(): string | null {
    return useAuthStore.getState().user?.id ?? null;
}

/** Coalesce de hidratação — evita disparar fetchProviders em duplicado. */
let hydratePromise: Promise<void> | null = null;

/** Coalesce de desbloqueio — chamadas concorrentes partilham a mesma derivação. */
let unlockPromise: Promise<{ success: boolean; error?: string }> | null = null;

const UNLOCK_PASSWORD_ERROR =
    'Password incorreta. As chaves de IA guardadas não podem ser descifradas com esta password.';

async function decryptKeys(
    providers: AIProvider[]
): Promise<Record<string, string>> {
    const apiKeys: Record<string, string> = {};
    for (const provider of providers) {
        if (!provider.apiKeyEncrypted || !provider.apiKeyIv) continue;
        const key = await aiProviderKeyService.decryptApiKey(provider);
        if (key) apiKeys[provider.id] = key;
    }
    return apiKeys;
}

/**
 * true se existir pelo menos uma linha com ciphertext que descifra com a chave
 * mestra atual — usado para validar a password contra as chaves guardadas.
 */
async function anyRowDecrypts(providers: AIProvider[]): Promise<boolean> {
    for (const provider of providers) {
        if (!provider.apiKeyEncrypted || !provider.apiKeyIv) continue;
        const key = await aiProviderKeyService.decryptApiKey(provider);
        if (key) return true;
    }
    return false;
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

            const userId = getCurrentUserId();
            const isUnlocked =
                !!userId && aiProviderKeyService.isUnlocked(userId);
            const apiKeys = isUnlocked ? await decryptKeys(providers) : {};

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
                isUnlocked,
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

    unlock: (password: string) => {
        if (unlockPromise) return unlockPromise;

        unlockPromise = (async (): Promise<{
            success: boolean;
            error?: string;
        }> => {
            const userId = getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Sessão não encontrada' };
            }

            try {
                await aiProviderKeyService.unlock(userId, password);

                // Carrega os provedores primeiro — a migração legacy (e a validação
                // da password abaixo) precisa da lista real de linhas da BD.
                await get().fetchProviders();

                // Valida a password: se existirem chaves cifradas mas nenhuma
                // descifrar com a chave derivada, a password está errada.
                const providers = get().providers;
                const rowsWithCiphertext = providers.filter(
                    (p) => p.apiKeyEncrypted && p.apiKeyIv
                );
                if (
                    rowsWithCiphertext.length > 0 &&
                    !(await anyRowDecrypts(providers))
                ) {
                    // Descarta a chave derivada errada para manter isUnlocked=false.
                    aiProviderKeyService.lock();
                    set({ isUnlocked: false, apiKeys: {}, isLoading: false });
                    return { success: false, error: UNLOCK_PASSWORD_ERROR };
                }

                // Migra as chaves antigas do localStorage (best-effort) — agora com
                // a lista de provedores carregada.
                await aiProviderKeyService.migrateLegacyKeys(get().providers);

                // Recarrega para descifrar as chaves (incluindo as recém-migradas).
                await get().fetchProviders();

                // Validação final após a migração: se alguma chave ficou cifrada
                // (ex.: chaves legacy cifradas com a chave derivada nesta chamada)
                // mas nenhuma descifra, a password está errada — descarta a chave
                // derivada para não persistir segredos sob uma chave incorreta.
                const postMigrationProviders = get().providers;
                const migratedRows = postMigrationProviders.filter(
                    (p) => p.apiKeyEncrypted && p.apiKeyIv
                );
                if (
                    migratedRows.length > 0 &&
                    !(await anyRowDecrypts(postMigrationProviders))
                ) {
                    aiProviderKeyService.lock();
                    set({ isUnlocked: false, apiKeys: {}, isLoading: false });
                    return { success: false, error: UNLOCK_PASSWORD_ERROR };
                }

                set({ isUnlocked: true, error: null });
                return { success: true };
            } catch (err) {
                const error =
                    err instanceof Error
                        ? err.message
                        : 'Erro ao desbloquear as chaves';
                return { success: false, error };
            }
        })().finally(() => {
            unlockPromise = null;
        });

        return unlockPromise;
    },

    lock: () => {
        aiProviderKeyService.lock();
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
        scope: 'user' | 'workspace' = 'user'
    ) => {
        try {
            const wsId = get().hydratedWorkspaceId;
            const provider = await aiProviderService.createCustomProvider(
                input,
                scope === 'workspace' && wsId
                    ? { type: 'workspace', workspaceId: wsId }
                    : { type: 'user' }
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
        if (!get().isUnlocked) {
            return {
                success: false,
                error: 'As chaves estão bloqueadas. Desbloqueia as chaves de IA primeiro.',
            };
        }
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