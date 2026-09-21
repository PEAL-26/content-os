import {
    aiProviderService,
    type AIProvider,
    type CreateCustomProviderInput,
    type UpdateProviderInput,
} from '@/services/ai-provider.service';
import { aiProviderKeyService } from '@/services/ai-provider-key.service';
import { supabase } from '@/lib/supabase';
import { create } from 'zustand';

interface AIProviderState {
    providers: AIProvider[];
    defaultProviderId: string | null;
    defaultModelCode: string | null;
    apiKeys: Record<string, string>;
    isLoading: boolean;
    error: string | null;

    fetchProviders: (workspaceId: string) => Promise<void>;
    setDefaultProvider: (workspaceId: string, providerId: string, modelCode: string) => Promise<void>;
    createCustomProvider: (workspaceId: string, input: CreateCustomProviderInput) => Promise<{ success: boolean; error?: string }>;
    updateProvider: (providerId: string, input: UpdateProviderInput) => Promise<{ success: boolean; error?: string }>;
    deleteProvider: (providerId: string, workspaceId: string) => Promise<{ success: boolean; error?: string }>;
    saveApiKey: (workspaceId: string, providerId: string, key: string) => void;
    removeApiKey: (workspaceId: string, providerId: string) => void;
    testConnection: (providerId: string, apiKey: string, baseUrl?: string | null, headers?: { key: string; value: string }[]) => Promise<{ success: boolean; error?: string }>;
}

export const useAIProviderStore = create<AIProviderState>((set, get) => ({
    providers: [],
    defaultProviderId: null,
    defaultModelCode: null,
    apiKeys: {},
    isLoading: false,
    error: null,

    fetchProviders: async (workspaceId: string) => {
        set({ isLoading: true, error: null });

        try {
            const providers = await aiProviderService.getProviders(workspaceId);
            const allKeys = aiProviderKeyService.getAllApiKeys(workspaceId);

            // Find workspace default
            const { data: workspace } = await supabase
                .from('workspaces')
                .select('defaultAIProviderId, defaultAIModel')
                .eq('id', workspaceId)
                .single();

            set({
                providers,
                apiKeys: allKeys,
                defaultProviderId: workspace?.defaultAIProviderId ?? null,
                defaultModelCode: workspace?.defaultAIModel ?? null,
                isLoading: false,
            });
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Erro ao carregar provedores';
            set({ isLoading: false, error });
        }
    },

    setDefaultProvider: async (workspaceId: string, providerId: string, modelCode: string) => {
        try {
            await aiProviderService.setDefaultProvider(workspaceId, providerId, modelCode);
            set({ defaultProviderId: providerId, defaultModelCode: modelCode });
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Erro ao definir provedor padrão';
            set({ error });
        }
    },

    createCustomProvider: async (workspaceId: string, input: CreateCustomProviderInput) => {
        try {
            const provider = await aiProviderService.createCustomProvider(workspaceId, input);
            set({ providers: [...get().providers, provider] });
            return { success: true };
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Erro ao criar provedor';
            return { success: false, error };
        }
    },

    updateProvider: async (providerId: string, input: UpdateProviderInput) => {
        try {
            const updated = await aiProviderService.updateProvider(providerId, input);
            set({
                providers: get().providers.map(p =>
                    p.id === providerId ? updated : p
                ),
            });
            return { success: true };
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Erro ao atualizar provedor';
            return { success: false, error };
        }
    },

    deleteProvider: async (providerId: string, _workspaceId: string) => {
        try {
            await aiProviderService.deleteProvider(providerId);
            set({
                providers: get().providers.filter(p => p.id !== providerId),
            });

            // If deleted provider was the default, clear it
            if (get().defaultProviderId === providerId) {
                set({ defaultProviderId: null, defaultModelCode: null });
            }

            return { success: true };
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Erro ao eliminar provedor';
            return { success: false, error };
        }
    },

    saveApiKey: (workspaceId: string, providerId: string, key: string) => {
        aiProviderKeyService.setApiKey(workspaceId, providerId, key);
        set({ apiKeys: { ...get().apiKeys, [providerId]: key } });
    },

    removeApiKey: (workspaceId: string, providerId: string) => {
        aiProviderKeyService.removeApiKey(workspaceId, providerId);
        const newKeys = { ...get().apiKeys };
        delete newKeys[providerId];
        set({ apiKeys: newKeys });
    },

    testConnection: async (providerId: string, apiKey: string, baseUrl?: string | null, headers?: { key: string; value: string }[]) => {
        try {
            // Build headers object
            const customHeaders: Record<string, string> = {};
            if (headers) {
                for (const h of headers) {
                    customHeaders[h.key] = h.value;
                }
            }

            // For default providers, try to hit their models endpoint
            // For custom providers, hit {baseUrl}/v1/models
            const provider = get().providers.find(p => p.providerId === providerId);

            if (provider?.isCustom && baseUrl) {
                const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        ...customHeaders,
                    },
                });

                if (response.ok) {
                    return { success: true };
                }

                const errorData = await response.text();
                return { success: false, error: `HTTP ${response.status}: ${errorData.slice(0, 200)}` };
            }

            // For default providers, do a simple validation check
            // (We can't easily test all providers, so we just check if the key format looks valid)
            if (!apiKey || apiKey.trim().length === 0) {
                return { success: false, error: 'API Key não pode estar vazia' };
            }

            // Basic validation passed
            return { success: true };
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Erro ao testar conexão';
            return { success: false, error };
        }
    },
}));
