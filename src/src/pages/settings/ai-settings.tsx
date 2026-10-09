import { useCallback, useEffect, useState } from 'react';
import { AIProviderCard } from '@/components/ai/ai-provider-card';
import { DefaultProviderSection } from '@/components/ai/default-provider-section';
import {
    ProviderEditorModal,
    type ProviderSaveData,
} from '@/components/ai/provider-editor-modal';
import { SystemPromptsEditor } from '@/components/ai/system-prompts-editor';
import { ArtifactModelSettingsCard } from '@/components/ai/artifact-model-settings-card';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAIProviders } from '@/hooks/use-ai-providers';
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
        editor,
        loadProviders,
        loadProvider,
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
    } = useAIProviders();

    const { currentWorkspace, workspaces } = useWorkspaceStore();
    const isWorkspaceOwner =
        workspaces.find((w) => w.id === currentWorkspace?.id)?.memberRole ===
        'OWNER';

    const [providerToDelete, setProviderToDelete] = useState<AIProvider | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success');
    const [promptsTab, setPromptsTab] = useState<'user' | 'workspace'>('user');

    useEffect(() => {
        loadProviders();
    }, [loadProviders]);

    const showFeedback = useCallback(
        (message: string, tone: 'success' | 'error' = 'success') => {
            setFeedbackMessage(message);
            setFeedbackTone(tone);
            setTimeout(() => setFeedbackMessage(null), 3000);
        },
        []
    );

    const handleConfirmDelete = async () => {
        if (!providerToDelete) return;
        setIsDeleting(true);
        const result = await handleDelete(providerToDelete);
        setIsDeleting(false);

        showFeedback(
            result.success
                ? 'Provedor eliminado com sucesso'
                : result.error || 'Erro ao eliminar provedor',
            result.success ? 'success' : 'error'
        );
        setProviderToDelete(null);
    };

    const handleKeyClick = async (provider: AIProvider) => {
        const result = await handleRemoveApiKey(provider);
        showFeedback(
            result.success
                ? 'Chave removida com sucesso'
                : result.error || 'Erro ao remover a chave',
            result.success ? 'success' : 'error'
        );
    };

    const handleEditorSave = async (data: ProviderSaveData) => {
        const isCreate = editor?.providerId === null;
        try {
            const result = await handleSave(data);
            if (result.success) {
                showFeedback(
                    isCreate
                        ? 'Provedor criado com sucesso'
                        : 'Provedor actualizado com sucesso'
                );
            } else {
                console.error('Erro ao guardar provedor:', result.error);
                showFeedback(
                    result.error || 'Erro ao guardar provedor',
                    'error'
                );
            }
            return result;
        } catch (err) {
            console.error('Erro inesperado ao guardar provedor', err);
            const message =
                err instanceof Error
                    ? err.message
                    : 'Erro inesperado ao guardar provedor';
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
                openEditor(
                    provider,
                    provider.workspaceId ? 'workspace' : 'user'
                )
            }
            onDelete={() => setProviderToDelete(provider)}
            onRemoveApiKey={() => void handleKeyClick(provider)}
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
                        onClick={() => openEditor(undefined, 'user')}
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
                            onClick={() => openEditor(undefined, 'workspace')}
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

            {/* MODELO POR MODALIDADE — quem gera a imagem, quem gera o áudio,
                quem gera o vídeo.
                É o nível acima das modalidades: no editor de providers
                declaras *que* um modelo produz imagem; aqui escolhes *qual*
                quando há mais do que um. "Automático" usa o primeiro activo por
                `priority`, que é a mesma cadeia de resolução do texto. */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Artefactos (imagem, áudio, vídeo)
                    </h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                        Só os modelos que declaram a modalidade aparecem aqui.
                        O custo de cada geração é mostrado antes de a pagares.
                    </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <ArtifactModelSettingsCard
                        workspaceId={currentWorkspace?.id ?? ''}
                        readOnly={!isWorkspaceOwner}
                    />
                </div>
            </div>

            {/* Editor de provider — o mesmo para criar e para editar, seeded
                e custom. Só o owner de um provider de workspace o consegue
                guardar; os restantes membros entram em modo leitura. */}
            {editor && (
                <ProviderEditorModal
                    isOpen
                    onClose={closeEditor}
                    providerId={editor.providerId}
                    scope={editor.scope}
                    readOnly={
                        editor.scope === 'workspace' && !isWorkspaceOwner
                    }
                    workspaceDefault={{
                        providerId: defaultProviderId,
                        modelCode: defaultModelCode,
                    }}
                    onLoad={loadProvider}
                    onSave={handleEditorSave}
                    onTest={handleTestModel}
                    onRemoveApiKey={handleRemoveEditorApiKey}
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