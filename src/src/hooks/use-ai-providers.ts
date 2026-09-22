import { useAIProviderStore } from '@/stores/ai-provider-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { AIProvider, CreateCustomProviderInput } from '@/services/ai-provider.service';
import type { AIProviderConfigOptions } from '@/lib/ai/types';
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
        isUnlocked,
        fetchProviders,
        unlock,
        lock,
        setDefaultProvider,
        createCustomProvider,
        updateProvider,
        deleteProvider,
        saveApiKey,
        removeApiKey,
        testConnection,
    } = useAIProviderStore();

    const workspaceId = workspace?.id;

    const [modalState, setModalState] = useState<{
        type: 'default' | 'custom' | null;
        provider: AIProvider | null;
        scope: 'user' | 'workspace';
    }>({ type: null, provider: null, scope: 'user' });

    const loadProviders = useCallback(async () => {
        await fetchProviders(workspaceId);
    }, [workspaceId, fetchProviders]);

    const openDefaultModal = useCallback((provider: AIProvider) => {
        setModalState({ type: 'default', provider, scope: 'user' });
    }, []);

    const openCustomModal = useCallback(
        (provider?: AIProvider, scope: 'user' | 'workspace' = 'user') => {
            setModalState({ type: 'custom', provider: provider ?? null, scope });
        },
        []
    );

    const closeModal = useCallback(() => {
        setModalState({ type: null, provider: null, scope: 'user' });
    }, []);

    const handleSetDefault = useCallback(async (providerId: string, modelCode: string) => {
        if (!workspaceId) return;
        await setDefaultProvider(workspaceId, providerId, modelCode);
    }, [workspaceId, setDefaultProvider]);

    const handleSaveDefaultApiKey = useCallback(async (data: {
        apiKey: string;
        config: AIProviderConfigOptions;
    }) => {
        if (!modalState.provider) {
            return { success: false, error: 'Sem provider selecionado' };
        }

        // Cifra e guarda a chave na BD (requer chave mestra desbloqueada)
        const saveResult = await saveApiKey(
            modalState.provider.id,
            data.apiKey
        );
        if (!saveResult.success) return saveResult;

        // Guarda a configuração padrão do provider
        const configResult = await updateProvider(modalState.provider.id, {
            config: data.config,
        });
        if (!configResult.success) return configResult;

        return { success: true };
    }, [modalState.provider, saveApiKey, updateProvider]);

    const handleCreateCustom = useCallback(async (data: {
        name: string;
        baseUrl: string;
        description?: string;
        apiKey: string;
        config: AIProviderConfigOptions;
        models: {
            displayName: string;
            modelCode: string;
            config: AIProviderConfigOptions;
        }[];
        headers: { key: string; value: string }[];
    }, scope: 'user' | 'workspace' = 'user') => {
        if (!isUnlocked) {
            return {
                success: false,
                error: 'As chaves estão bloqueadas. Desbloqueia as chaves de IA antes de criar o provedor.',
            };
        }

        const input: CreateCustomProviderInput = {
            name: data.name,
            baseUrl: data.baseUrl,
            description: data.description,
            config: data.config,
            models: data.models,
            headers: data.headers,
        };

        const result = await createCustomProvider(input, scope);

        if (result.success && result.provider) {
            // Guarda a API key cifrada na BD, associada ao novo provedor.
            // Se as chaves estiverem bloqueadas — ou a gravação falhar (ex.:
            // a chave existente não pode ser descifrada) — devolve o erro em
            // vez de reportar sucesso com a chave descartada.
            const saveResult = await saveApiKey(
                result.provider.id,
                data.apiKey
            );
            if (!saveResult.success) {
                return saveResult;
            }
        }

        return result;
    }, [createCustomProvider, saveApiKey, isUnlocked]);

    const handleUpdateCustom = useCallback(async (data: {
        name: string;
        baseUrl: string;
        description?: string;
        apiKey: string;
        config: AIProviderConfigOptions;
        models: {
            displayName: string;
            modelCode: string;
            config: AIProviderConfigOptions;
        }[];
        headers: { key: string; value: string }[];
    }) => {
        if (!modalState.provider) return { success: false, error: 'No provider' };

        if (!isUnlocked) {
            return {
                success: false,
                error: 'As chaves estão bloqueadas. Desbloqueia as chaves de IA antes de guardar a API key.',
            };
        }

        const result = await updateProvider(modalState.provider.id, {
            name: data.name,
            baseUrl: data.baseUrl,
            description: data.description,
            config: data.config,
            models: data.models,
            headers: data.headers,
        });

        if (result.success) {
            const saveResult = await saveApiKey(
                modalState.provider.id,
                data.apiKey
            );
            if (!saveResult.success) {
                return saveResult;
            }
        }

        return result;
    }, [modalState.provider, updateProvider, saveApiKey, isUnlocked]);

    const handleDelete = useCallback(async (provider: AIProvider) => {
        return deleteProvider(provider.id);
    }, [deleteProvider]);

    const handleTestConnection = useCallback(async (
        modelCode: string,
        apiKey: string,
        baseUrl?: string,
        headers?: { key: string; value: string }[]
    ) => {
        if (!modalState.provider) return { success: false, error: 'No provider' };
        return testConnection(
            modalState.provider,
            modelCode,
            apiKey,
            baseUrl ?? modalState.provider.baseUrl,
            headers
        );
    }, [modalState.provider, testConnection]);

    const canDelete = useCallback((provider: AIProvider) => {
        if (provider.isDefault) return false;
        if (provider.id === defaultProviderId) return false;
        return true;
    }, [defaultProviderId]);

    const isConfigured = useCallback((providerId: string) => {
        // `providerId` aqui é o row id da BD (provider.id)
        return !!apiKeys[providerId];
    }, [apiKeys]);

    const defaultProvider = useMemo(() => {
        // defaultProviderId é agora o row id de ai_providers
        return providers.find((p) => p.id === defaultProviderId) ?? null;
    }, [providers, defaultProviderId]);

    const handleUnlock = useCallback(async (password: string) => {
        return unlock(password);
    }, [unlock]);

    const handleLock = useCallback(() => {
        lock();
    }, [lock]);

    const handleRemoveApiKey = useCallback(async (provider: AIProvider) => {
        return removeApiKey(provider.id);
    }, [removeApiKey]);

    return {
        providers,
        defaultProvider,
        defaultProviderId,
        defaultModelCode,
        apiKeys,
        isLoading,
        error,
        isUnlocked,
        modalState,
        loadProviders,
        handleUnlock,
        handleLock,
        openDefaultModal,
        openCustomModal,
        closeModal,
        handleSetDefault,
        handleSaveDefaultApiKey,
        handleCreateCustom,
        handleUpdateCustom,
        handleDelete,
        handleTestConnection,
        handleRemoveApiKey,
        canDelete,
        isConfigured,
    };
}
