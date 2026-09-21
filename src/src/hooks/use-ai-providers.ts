import { useAIProviderStore } from '@/stores/ai-provider-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { AIProvider, CreateCustomProviderInput } from '@/services/ai-provider.service';
import { useState, useCallback, useMemo } from 'react';

export function useAIProviders() {
    const workspace = useWorkspaceStore((s) => s.currentWorkspace);
    const {
        providers,
        defaultProviderId,
        defaultModelCode,
        apiKeys,
        isLoading,
        error,
        fetchProviders,
        setDefaultProvider,
        createCustomProvider,
        updateProvider,
        deleteProvider,
        saveApiKey,
        testConnection,
    } = useAIProviderStore();

    const workspaceId = workspace?.id;

    const [modalState, setModalState] = useState<{
        type: 'default' | 'custom' | null;
        provider: AIProvider | null;
    }>({ type: null, provider: null });

    const loadProviders = useCallback(async () => {
        if (!workspaceId) return;
        await fetchProviders(workspaceId);
    }, [workspaceId, fetchProviders]);

    const openDefaultModal = useCallback((provider: AIProvider) => {
        setModalState({ type: 'default', provider });
    }, []);

    const openCustomModal = useCallback((provider?: AIProvider) => {
        setModalState({ type: 'custom', provider: provider ?? null });
    }, []);

    const closeModal = useCallback(() => {
        setModalState({ type: null, provider: null });
    }, []);

    const handleSetDefault = useCallback(async (providerId: string, modelCode: string) => {
        if (!workspaceId) return;
        await setDefaultProvider(workspaceId, providerId, modelCode);
    }, [workspaceId, setDefaultProvider]);

    const handleSaveDefaultApiKey = useCallback(async (apiKey: string) => {
        if (!workspaceId || !modalState.provider) return;
        saveApiKey(workspaceId, modalState.provider.providerId, apiKey);
    }, [workspaceId, modalState.provider, saveApiKey]);

    const handleCreateCustom = useCallback(async (data: {
        name: string;
        baseUrl: string;
        description?: string;
        apiKey: string;
        models: { displayName: string; modelCode: string }[];
        headers: { key: string; value: string }[];
    }) => {
        if (!workspaceId) return { success: false, error: 'No workspace' };

        const input: CreateCustomProviderInput = {
            name: data.name,
            baseUrl: data.baseUrl,
            description: data.description,
            models: data.models,
            headers: data.headers,
        };

        const result = await createCustomProvider(workspaceId, input);

        if (result.success && result.success) {
            // Save the API key separately
            const newProviders = useAIProviderStore.getState().providers;
            const newProvider = newProviders[newProviders.length - 1];
            if (newProvider) {
                saveApiKey(workspaceId, newProvider.providerId, data.apiKey);
            }
        }

        return result;
    }, [workspaceId, createCustomProvider, saveApiKey]);

    const handleUpdateCustom = useCallback(async (data: {
        name: string;
        baseUrl: string;
        description?: string;
        apiKey: string;
        models: { displayName: string; modelCode: string }[];
        headers: { key: string; value: string }[];
    }) => {
        if (!workspaceId || !modalState.provider) return { success: false, error: 'No provider' };

        const result = await updateProvider(modalState.provider.id, {
            name: data.name,
            baseUrl: data.baseUrl,
            description: data.description,
            models: data.models,
            headers: data.headers,
        });

        if (result.success) {
            saveApiKey(workspaceId, modalState.provider.providerId, data.apiKey);
        }

        return result;
    }, [workspaceId, modalState.provider, updateProvider, saveApiKey]);

    const handleDelete = useCallback(async (provider: AIProvider) => {
        if (!workspaceId) return { success: false, error: 'No workspace' };
        return deleteProvider(provider.id, workspaceId);
    }, [workspaceId, deleteProvider]);

    const handleTestConnection = useCallback(async (apiKey: string, baseUrl?: string, headers?: { key: string; value: string }[]) => {
        if (!modalState.provider) return { success: false, error: 'No provider' };
        return testConnection(modalState.provider.providerId, apiKey, baseUrl ?? modalState.provider.baseUrl, headers);
    }, [modalState.provider, testConnection]);

    const canDelete = useCallback((provider: AIProvider) => {
        if (provider.isDefault) return false;
        if (provider.providerId === defaultProviderId) return false;
        return true;
    }, [defaultProviderId]);

    const isConfigured = useCallback((providerId: string) => {
        return !!apiKeys[providerId];
    }, [apiKeys]);

    const defaultProvider = useMemo(() => {
        return providers.find(p => p.providerId === defaultProviderId) ?? null;
    }, [providers, defaultProviderId]);

    return {
        providers,
        defaultProvider,
        defaultProviderId,
        defaultModelCode,
        apiKeys,
        isLoading,
        error,
        modalState,
        loadProviders,
        openDefaultModal,
        openCustomModal,
        closeModal,
        handleSetDefault,
        handleSaveDefaultApiKey,
        handleCreateCustom,
        handleUpdateCustom,
        handleDelete,
        handleTestConnection,
        canDelete,
        isConfigured,
    };
}
