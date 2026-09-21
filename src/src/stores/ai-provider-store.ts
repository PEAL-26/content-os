import {
    aiProviderService,
    type AIProvider,
    type CreateCustomProviderInput,
    type UpdateProviderInput,
} from '@/services/ai-provider.service';
import { aiProviderKeyService } from '@/services/ai-provider-key.service';
import { create } from 'zustand';

interface AIProviderState {
    providers: AIProvider[];
    defaultProviderId: string | null;
    defaultModelCode: string | null;
    apiKeys: Record<string, string>;
    isLoading: boolean;
    error: string | null;

    fetchProviders: (workspaceId?: string) => Promise<void>;
    setDefaultProvider: (
        workspaceId: string,
        providerId: string,
        modelCode: string
    ) => Promise<void>;
    createCustomProvider: (
        input: CreateCustomProviderInput
    ) => Promise<{ success: boolean; error?: string; provider?: AIProvider }>;
    updateProvider: (
        providerId: string,
        input: UpdateProviderInput
    ) => Promise<{ success: boolean; error?: string }>;
    deleteProvider: (
        providerId: string
    ) => Promise<{ success: boolean; error?: string }>;
    saveApiKey: (providerId: string, key: string) => void;
    removeApiKey: (providerId: string) => void;
    testConnection: (
        providerId: string,
        apiKey: string,
        baseUrl?: string | null,
        headers?: { key: string; value: string }[]
    ) => Promise<{ success: boolean; error?: string }>;
}

export const useAIProviderStore = create<AIProviderState>((set, get) => ({
    providers: [],
    defaultProviderId: null,
    defaultModelCode: null,
    apiKeys: {},
    isLoading: false,
    error: null,

    // Provedores e chaves são globais (conta). O workspaceId é usado apenas
    // para carregar o provedor padrão desse workspace (workspaces.defaultAIProviderId).
    fetchProviders: async (workspaceId?: string) => {
        set({ isLoading: true, error: null });

        try {
            let providers = await aiProviderService.getProviders();

            // Seed global: cria os provedores padrão na primeira utilização.
            if (providers.length === 0) {
                await aiProviderService.ensureDefaultProviders();
                providers = await aiProviderService.getProviders();
            }

            const apiKeys = aiProviderKeyService.getAllApiKeys();

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
                defaultProviderId,
                defaultModelCode,
                isLoading: false,
            });
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar provedores';
            set({ isLoading: false, error });
        }
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

    createCustomProvider: async (input: CreateCustomProviderInput) => {
        try {
            const provider =
                await aiProviderService.createCustomProvider(input);
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

    saveApiKey: (providerId: string, key: string) => {
        aiProviderKeyService.setApiKey(providerId, key);
        set({ apiKeys: { ...get().apiKeys, [providerId]: key } });
    },

    removeApiKey: (providerId: string) => {
        aiProviderKeyService.removeApiKey(providerId);
        const newKeys = { ...get().apiKeys };
        delete newKeys[providerId];
        set({ apiKeys: newKeys });
    },

    testConnection: async (
        providerId: string,
        apiKey: string,
        baseUrl?: string | null,
        headers?: { key: string; value: string }[]
    ) => {
        try {
            const customHeaders: Record<string, string> = {};
            if (headers) {
                for (const h of headers) {
                    customHeaders[h.key] = h.value;
                }
            }

            const provider = get().providers.find(
                (p) => p.providerId === providerId
            );

            if (provider?.isCustom && baseUrl) {
                const response = await fetch(
                    `${baseUrl.replace(/\/$/, '')}/v1/models`,
                    {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                            ...customHeaders,
                        },
                    }
                );

                if (response.ok) {
                    return { success: true };
                }

                const errorData = await response.text();
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${errorData.slice(0, 200)}`,
                };
            }

            if (!apiKey || apiKey.trim().length === 0) {
                return {
                    success: false,
                    error: 'API Key não pode estar vazia',
                };
            }

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