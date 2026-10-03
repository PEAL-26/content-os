import { useCallback, useMemo, useState } from 'react';
import { useAIProviderStore } from '@/stores/ai-provider-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type {
    AIProvider,
    AIProviderModel,
    CreateCustomProviderInput,
} from '@/services/ai-provider.service';
import type {
    HeaderDraft,
    ModelDraft,
    ProviderSaveData,
} from '@/components/ai/provider-editor-modal';

export interface EditorState {
    /** `null` = a criar um provider customizado novo. */
    providerId: string | null;
    scope: 'user' | 'workspace';
}

/** Provider sintético para testar um provider que ainda não foi criado. */
function draftProvider(name: string): AIProvider {
    return {
        id: '',
        providerId: 'custom_draft',
        name: name.trim() || 'Provedor (rascunho)',
        description: null,
        baseUrl: null,
        userId: null,
        workspaceId: null,
        apiKeyEncrypted: null,
        apiKeyIv: null,
        config: null,
        isDefault: false,
        isCustom: true,
        isActive: true,
        priority: 0,
        createdAt: '',
        updatedAt: '',
        models: [],
        headers: [],
    };
}

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
        fetchProviderById,
        setDefaultProvider,
        createCustomProvider,
        updateProvider,
        deleteProvider,
        saveApiKey,
        removeApiKey,
        testConnection,
    } = useAIProviderStore();

    const workspaceId = workspace?.id;

    const [editor, setEditor] = useState<EditorState | null>(null);

    const loadProviders = useCallback(async () => {
        await fetchProviders(workspaceId);
    }, [workspaceId, fetchProviders]);

    const openEditor = useCallback(
        (provider?: AIProvider, scope: 'user' | 'workspace' = 'user') => {
            setEditor({ providerId: provider?.id ?? null, scope });
        },
        []
    );

    const closeEditor = useCallback(() => {
        setEditor(null);
    }, []);

    const handleSetDefault = useCallback(
        async (providerId: string, modelCode: string) => {
            if (!workspaceId) return;
            await setDefaultProvider(workspaceId, providerId, modelCode);
        },
        [workspaceId, setDefaultProvider]
    );

    /**
     * Grava. `apiKey` a `undefined` significa "não tocar na chave" — o editor
     * só o preenche quando o utilizador escreve algo no campo. Antes, o save
     * reescrevia a chave incondicionalmente e não dava para editar um provider
     * sem a reintroduzir.
     */
    const handleSave = useCallback(
        async (data: ProviderSaveData) => {
            if (!editor) return { success: false, error: 'Nenhum provedor seleccionado' };

            // Criar
            if (editor.providerId === null) {
                if (editor.scope === 'workspace' && !workspaceId) {
                    return {
                        success: false,
                        error: 'Seleciona um workspace antes de criar o provedor de workspace.',
                    };
                }

                const input: CreateCustomProviderInput = {
                    name: data.name,
                    baseUrl: data.baseUrl,
                    description: data.description,
                    config: data.config,
                    models: data.models.map((m: ModelDraft) => ({
                        displayName: m.displayName,
                        modelCode: m.modelCode,
                        config: m.config,
                    })),
                    headers: data.headers,
                };

                const result = await createCustomProvider(
                    input,
                    editor.scope,
                    workspaceId ?? null
                );
                if (!result.success || !result.provider) return result;

                // Só grava a chave se o user escreveu uma. Um provider sem
                // chave é guardado (e avisado no editor) em vez de falhar.
                if (data.apiKey) {
                    const keyResult = await saveApiKey(
                        result.provider.id,
                        data.apiKey
                    );
                    if (!keyResult.success) return keyResult;
                }
                return result;
            }

            // Actualizar
            const result = await updateProvider(editor.providerId, {
                name: data.name,
                baseUrl: data.baseUrl,
                description: data.description,
                config: data.config,
                models: data.models,
                headers: data.headers,
            });
            if (!result.success) return result;

            if (data.apiKey) {
                const keyResult = await saveApiKey(
                    editor.providerId,
                    data.apiKey
                );
                if (!keyResult.success) return keyResult;
            }
            return { success: true };
        },
        [editor, workspaceId, createCustomProvider, updateProvider, saveApiKey]
    );

    /**
     * Testa um modelo do rascunho. O modelo vem pronto do formulário (pode ser
     * uma linha nova ainda não guardada) — é por isso que já não usamos
     * `pickModel`, que caía silenciosamente em `models[0]` e testava o modelo
     * errado.
     */
    const handleTestModel = useCallback(
        async (
            model: AIProviderModel,
            apiKey: string,
            baseUrl: string,
            headers: HeaderDraft[],
            draftName?: string
        ) => {
            const providerId = editor?.providerId ?? null;
            const provider = providerId
                ? (providers.find((p) => p.id === providerId) ?? null)
                : draftProvider(draftName ?? '');

            if (!provider) {
                return {
                    success: false,
                    error: 'Provedor não encontrado. Abre o editor de novo.',
                };
            }
            return testConnection(provider, model, apiKey, baseUrl, headers);
        },
        [editor, providers, testConnection]
    );

    const handleRemoveEditorApiKey = useCallback(async () => {
        if (!editor?.providerId) {
            return { success: false, error: 'Nenhum provedor seleccionado' };
        }
        return removeApiKey(editor.providerId);
    }, [editor, removeApiKey]);

    const handleDelete = useCallback(
        async (provider: AIProvider) => deleteProvider(provider.id),
        [deleteProvider]
    );

    const canDelete = useCallback(
        (provider: AIProvider) => {
            if (provider.isDefault) return false;
            if (provider.id === defaultProviderId) return false;
            return true;
        },
        [defaultProviderId]
    );

    const isConfigured = useCallback(
        (providerId: string) => !!apiKeys[providerId],
        [apiKeys]
    );

    const defaultProvider = useMemo(
        () => providers.find((p) => p.id === defaultProviderId) ?? null,
        [providers, defaultProviderId]
    );

    const handleRemoveApiKey = useCallback(
        async (provider: AIProvider) => removeApiKey(provider.id),
        [removeApiKey]
    );

    return {
        providers,
        defaultProvider,
        defaultProviderId,
        defaultModelCode,
        apiKeys,
        isLoading,
        error,
        editor,
        loadProviders,
        loadProvider: fetchProviderById,
        openEditor,
        closeEditor,
        handleSetDefault,
        handleSave,
        handleTestModel,
        handleRemoveEditorApiKey,
        handleDelete,
        handleRemoveApiKey,
        canDelete,
        isConfigured,
    };
}