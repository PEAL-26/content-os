import { useEffect, useState } from 'react';
import { AIProviderCard } from '@/components/ai/ai-provider-card';
import { DefaultProviderSection } from '@/components/ai/default-provider-section';
import { DefaultProviderModal } from '@/components/ai/default-provider-modal';
import { CustomProviderModal } from '@/components/ai/custom-provider-modal';
import { SystemPromptsEditor } from '@/components/ai/system-prompts-editor';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAIProviders } from '@/hooks/use-ai-providers';
import type { AIProviderConfigOptions } from '@/lib/ai/types';
import type { AIProvider } from '@/services/ai-provider.service';
import { useWorkspaceStore } from '@/stores/workspace-store';

export function AISettingsPage() {
    const {
        providers,
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
        handleRemoveApiKey,
        handleTestConnection,
        canDelete,
        isConfigured,
    } = useAIProviders();

    const { currentWorkspace, workspaces } = useWorkspaceStore();
    const isWorkspaceOwner =
        workspaces.find((w) => w.id === currentWorkspace?.id)?.memberRole ===
        'OWNER';

    const [providerToDelete, setProviderToDelete] = useState<AIProvider | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success');
    const [unlockPassword, setUnlockPassword] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState<string | null>(null);
    const [promptsTab, setPromptsTab] = useState<'user' | 'workspace'>('user');

    useEffect(() => {
        loadProviders();
    }, [loadProviders]);

    const showFeedback = (message: string, tone: 'success' | 'error' = 'success') => {
        setFeedbackMessage(message);
        setFeedbackTone(tone);
        setTimeout(() => setFeedbackMessage(null), 3000);
    };

    const handleDeleteClick = (provider: AIProvider) => {
        setProviderToDelete(provider);
    };

    const handleConfirmDelete = async () => {
        if (!providerToDelete) return;
        setIsDeleting(true);
        const result = await handleDelete(providerToDelete);
        setIsDeleting(false);

        if (result.success) {
            showFeedback('Provedor eliminado com sucesso');
        } else {
            showFeedback(result.error || 'Erro ao eliminar provedor');
        }

        setProviderToDelete(null);
    };

    const handleRemoveKey = async (provider: AIProvider) => {
        const result = await handleRemoveApiKey(provider);
        if (result.success) {
            showFeedback('Chave removida com sucesso');
        } else {
            showFeedback(result.error || 'Erro ao remover a chave', 'error');
        }
    };

    const handleSaveDefaultModal = async (data: {
        apiKey: string;
        config: AIProviderConfigOptions;
    }) => {
        const result = await handleSaveDefaultApiKey(data);
        if (result && result.success === false) {
            showFeedback(result.error || 'Erro ao guardar a API Key');
        } else {
            showFeedback('API Key guardada com sucesso');
        }
    };

    const handleUnlockClick = async () => {
        if (!unlockPassword) return;
        setIsUnlocking(true);
        setUnlockError(null);
        const result = await handleUnlock(unlockPassword);
        setIsUnlocking(false);
        if (!result.success) {
            setUnlockError(
                result.error || 'Não foi possível desbloquear as chaves'
            );
        } else {
            setUnlockPassword('');
        }
    };

    const handleSaveCustomModal = async (data: {
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
    }): Promise<{ success: boolean; error?: string }> => {
        try {
            let result;
            if (modalState.provider) {
                result = await handleUpdateCustom(data);
            } else {
                result = await handleCreateCustom(data, modalState.scope);
            }

            if (result.success) {
                showFeedback(modalState.provider ? 'Provedor atualizado com sucesso' : 'Provedor criado com sucesso');
            } else {
                console.error('Erro ao guardar provedor customizado:', result.error);
                showFeedback(result.error || 'Erro ao guardar provedor', 'error');
            }
            return result;
        } catch (err) {
            console.error('Erro inesperado ao guardar provedor customizado', err);
            const message =
                err instanceof Error ? err.message : 'Erro inesperado ao guardar provedor';
            showFeedback(message, 'error');
            return { success: false, error: message };
        }
    };

    if (isLoading && providers.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        );
    }

    // Providers de âmbito pessoal (sempre visíveis) vs do workspace atual.
    const userProviders = providers.filter((p) => !p.workspaceId);
    const workspaceProviders = providers.filter(
        (p) => p.workspaceId === currentWorkspace?.id
    );

    const renderProviderCard = (provider: AIProvider) => (
        <AIProviderCard
            key={provider.id}
            provider={provider}
            hasApiKey={isConfigured(provider.id)}
            isDefault={provider.id === defaultProviderId}
            ownerKeyBadge={
                provider.workspaceId === currentWorkspace?.id &&
                !isWorkspaceOwner
            }
            onConfigure={() =>
                provider.isCustom
                    ? openCustomModal(provider, provider.workspaceId ? 'workspace' : 'user')
                    : openDefaultModal(provider)
            }
            onDelete={() => handleDeleteClick(provider)}
            onRemoveApiKey={() => handleRemoveKey(provider)}
            canDelete={canDelete(provider)}
        />
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Configurações de IA
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Configure os provedores de inteligência artificial e os
                    prompts usados para gerar conteúdo.
                </p>
            </div>

            {isUnlocked && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={handleLock}
                        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Bloquear chaves
                    </button>
                </div>
            )}

            {feedbackMessage && (
                <div
                    className={
                        feedbackTone === 'error'
                            ? 'rounded-md bg-red-50 p-3'
                            : 'rounded-md bg-green-50 p-3'
                    }
                >
                    <p
                        className={
                            feedbackTone === 'error'
                                ? 'flex items-center gap-2 text-sm text-red-700'
                                : 'flex items-center gap-2 text-sm text-green-700'
                        }
                    >
                        {feedbackTone === 'error' ? (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {feedbackMessage}
                    </p>
                </div>
            )}

            {error && (
                <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Unlock AI keys */}
            {!isUnlocked && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
                    <div>
                        <h2 className="text-lg font-semibold text-amber-900">
                            Desbloquear chaves de IA
                        </h2>
                        <p className="mt-1 text-sm text-amber-800">
                            As chaves estão guardadas cifradas com a tua password.
                            Introduz a password da conta para as descifrar em
                            memória (as chaves nunca são persistidas em claro).
                        </p>
                    </div>

                    {unlockError && (
                        <p className="mt-2 text-sm text-red-700">{unlockError}</p>
                    )}

                    <div className="mt-4 flex items-center gap-3">
                        <input
                            type="password"
                            value={unlockPassword}
                            onChange={(e) => setUnlockPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUnlockClick();
                            }}
                            placeholder="Password da conta"
                            className="w-72 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleUnlockClick}
                            disabled={!unlockPassword || isUnlocking}
                            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                        >
                            {isUnlocking ? 'A descifrar…' : 'Desbloquear'}
                        </button>
                    </div>
                </div>
            )}

            {/* Default Provider Section */}
            <DefaultProviderSection
                providers={providers}
                defaultProviderId={defaultProviderId}
                defaultModelCode={defaultModelCode}
                apiKeys={apiKeys}
                onSetDefault={handleSetDefault}
            />

            {/* Provedores pessoais */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Provedores Pessoais
                        </h2>
                        <p className="mt-0.5 text-sm text-gray-500">
                            Só tu vês estes provedores e só os teus conteúdos os
                            usam.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => openCustomModal(undefined, 'user')}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Adicionar Customizado
                    </button>
                </div>

                {userProviders.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">
                            Nenhum provedor pessoal configurado
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Os provedores padrão são criados automaticamente para
                            a tua conta.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {userProviders.map(renderProviderCard)}
                    </div>
                )}
            </div>

            {/* Provedores do workspace */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Provedores do Workspace
                        </h2>
                        <p className="mt-0.5 text-sm text-gray-500">
                            Visíveis a todos os membros. Só o proprietário gere
                            estes provedores.
                        </p>
                    </div>
                    {isWorkspaceOwner && (
                        <button
                            type="button"
                            onClick={() => openCustomModal(undefined, 'workspace')}
                            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Adicionar Customizado
                        </button>
                    )}
                </div>

                {!isWorkspaceOwner ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
                        <p className="text-sm text-gray-600">
                            Só o proprietário do workspace pode adicionar ou
                            editar provedores de workspace. Fala com ele para
                            configurar provedores partilhados.
                        </p>
                    </div>
                ) : workspaceProviders.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                        <h3 className="text-sm font-semibold text-gray-900">
                            Nenhum provedor de workspace
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Adiciona provedores customizados partilhados por toda
                            a equipa.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {workspaceProviders.map(renderProviderCard)}
                    </div>
                )}
            </div>

            {/* System Prompts */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Prompts de IA
                    </h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                        Prompt de sistema usado para cada tipo de conteúdo. Vês
                        o predefinido em cada campo — edita e guarda para
                        personalizar, ou usa "Restaurar padrão". Os do
                        workspace têm prioridade sobre os pessoais.
                    </p>
                </div>

                <Tabs
                    value={promptsTab}
                    onValueChange={(v) =>
                        setPromptsTab(v as 'user' | 'workspace')
                    }
                >
                    <TabsList>
                        <TabsTrigger value="user">Pessoais</TabsTrigger>
                        <TabsTrigger value="workspace">
                            {isWorkspaceOwner
                                ? 'Workspace'
                                : 'Workspace (só leitura)'}
                        </TabsTrigger>
                    </TabsList>

                    {/* Ambos os painéis ficam montados (oculto via CSS) para
                        não perder edições não guardadas ao alternar de tab. */}
                    <div
                        role="tabpanel"
                        className={
                            promptsTab === 'user' ? 'mt-4' : 'mt-4 hidden'
                        }
                    >
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <p className="mb-4 text-xs text-gray-500">
                                Aplicam-se aos teus conteúdos em todos os
                                workspaces.
                            </p>
                            <SystemPromptsEditor scope="user" workspace={currentWorkspace} />
                        </div>
                    </div>

                    <div
                        role="tabpanel"
                        className={
                            promptsTab === 'workspace'
                                ? 'mt-4'
                                : 'mt-4 hidden'
                        }
                    >
                        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                            <p className="mb-4 text-xs text-gray-500">
                                Aplicam-se a todos os membros. Só o proprietário
                                edita.
                            </p>
                            <SystemPromptsEditor
                                scope="workspace"
                                workspace={currentWorkspace}
                                readOnly={!isWorkspaceOwner}
                            />
                        </div>
                    </div>
                </Tabs>
            </div>

            {/* Default Provider Modal */}
            {modalState.type === 'default' && modalState.provider && (
                <DefaultProviderModal
                    isOpen={true}
                    onClose={closeModal}
                    provider={modalState.provider}
                    currentApiKey={apiKeys[modalState.provider.id] ?? null}
                    onSave={handleSaveDefaultModal}
                    onTest={handleTestConnection}
                />
            )}

            {/* Custom Provider Modal */}
            {modalState.type === 'custom' && (
                <CustomProviderModal
                    isOpen={true}
                    onClose={closeModal}
                    provider={modalState.provider}
                    scope={modalState.scope}
                    onSave={handleSaveCustomModal}
                    onTest={handleTestConnection}
                    existingApiKey={modalState.provider ? (apiKeys[modalState.provider.id] ?? null) : null}
                />
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={!!providerToDelete}
                onClose={() => setProviderToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Eliminar Provedor"
                message={`Tem certeza que deseja eliminar "${providerToDelete?.name}"? Esta ação não pode ser revertida.`}
                confirmText="Eliminar"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}