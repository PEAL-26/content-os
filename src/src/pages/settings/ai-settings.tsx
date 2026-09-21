import { useEffect, useState } from 'react';
import { AIProviderCard } from '@/components/ai/ai-provider-card';
import { DefaultProviderSection } from '@/components/ai/default-provider-section';
import { DefaultProviderModal } from '@/components/ai/default-provider-modal';
import { CustomProviderModal } from '@/components/ai/custom-provider-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useAIProviders } from '@/hooks/use-ai-providers';
import type { AIProvider } from '@/services/ai-provider.service';

export function AISettingsPage() {
    const {
        providers,
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
    } = useAIProviders();

    const [providerToDelete, setProviderToDelete] = useState<AIProvider | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    useEffect(() => {
        loadProviders();
    }, [loadProviders]);

    const showFeedback = (message: string) => {
        setFeedbackMessage(message);
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

    const handleSaveDefaultModal = async (apiKey: string) => {
        handleSaveDefaultApiKey(apiKey);
        showFeedback('API Key guardada com sucesso');
    };

    const handleSaveCustomModal = async (data: {
        name: string;
        baseUrl: string;
        description?: string;
        apiKey: string;
        models: { displayName: string; modelCode: string }[];
        headers: { key: string; value: string }[];
    }) => {
        let result;
        if (modalState.provider) {
            result = await handleUpdateCustom(data);
        } else {
            result = await handleCreateCustom(data);
        }

        if (result.success) {
            showFeedback(modalState.provider ? 'Provedor atualizado com sucesso' : 'Provedor criado com sucesso');
        } else {
            showFeedback(result.error || 'Erro ao guardar provedor');
        }
    };

    if (isLoading && providers.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Configurações de IA
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Configure os provedores de inteligência artificial para gerar conteúdo.
                </p>
            </div>

            {feedbackMessage && (
                <div className="rounded-md bg-green-50 p-3">
                    <p className="flex items-center gap-2 text-sm text-green-700">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feedbackMessage}
                    </p>
                </div>
            )}

            {error && (
                <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-700">{error}</p>
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

            {/* Providers Grid */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Provedores Disponíveis
                    </h2>
                    <button
                        type="button"
                        onClick={() => openCustomModal()}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Adicionar Customizado
                    </button>
                </div>

                {providers.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">
                            Nenhum provedor configurado
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Os provedores padrão serão criados automaticamente ao inicializar o workspace.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {providers.map((provider) => (
                            <AIProviderCard
                                key={provider.id}
                                provider={provider}
                                hasApiKey={isConfigured(provider.providerId)}
                                isDefault={provider.providerId === defaultProviderId}
                                onConfigure={() =>
                                    provider.isCustom
                                        ? openCustomModal(provider)
                                        : openDefaultModal(provider)
                                }
                                onDelete={() => handleDeleteClick(provider)}
                                canDelete={canDelete(provider)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Default Provider Modal */}
            {modalState.type === 'default' && modalState.provider && (
                <DefaultProviderModal
                    isOpen={true}
                    onClose={closeModal}
                    provider={modalState.provider}
                    currentApiKey={apiKeys[modalState.provider.providerId] ?? null}
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
                    onSave={handleSaveCustomModal}
                    onTest={handleTestConnection}
                    existingApiKey={modalState.provider ? (apiKeys[modalState.provider.providerId] ?? null) : null}
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
