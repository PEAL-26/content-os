import { WorkspaceCard } from '@/components/workspace/workspace-card';
import { WorkspaceFormModal } from '@/components/workspace/workspace-form-modal';
import { useAuthContext } from '@/context/use-auth-context';
import { useWorkspace } from '@/hooks/use-workspace';
import type { CreateWorkspaceFormData } from '@/lib/schemas/workspace';
import { workspacePath } from '@/lib/workspace-paths';
import type { WorkspaceWithRole } from '@/types/database';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type ModalState =
    | { mode: 'create'; workspace: null }
    | { mode: 'edit'; workspace: WorkspaceWithRole }
    | null;

export function WorkspaceSettingsPage() {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const {
        currentWorkspace,
        workspaces,
        setWorkspace,
        createWorkspace,
        updateWorkspace,
        isLoading,
        error,
        clearError,
    } = useWorkspace();

    const [modal, setModal] = useState<ModalState>(null);

    const openCreate = () => {
        clearError();
        setModal({ mode: 'create', workspace: null });
    };

    const openEdit = (workspace: WorkspaceWithRole) => {
        clearError();
        setModal({ mode: 'edit', workspace });
    };

    const closeModal = () => {
        clearError();
        setModal(null);
    };

    const handleEnter = (workspace: WorkspaceWithRole) => {
        setWorkspace(workspace);
        navigate(workspacePath(workspace.id, 'dashboard'));
    };

    const buildInput = (data: CreateWorkspaceFormData) => ({
        name: data.name,
        description: data.description,
        sector: data.sector,
        website: data.website || undefined,
        voiceTone: data.voiceTone,
        targetAudience: data.targetAudience,
        valueProposition: data.valueProposition,
        contentLanguage: data.contentLanguage,
        valueRatio: data.valueRatio,
        productRatio: 100 - (data.valueRatio ?? 70),
    });

    const handleSubmit = async (data: CreateWorkspaceFormData) => {
        if (modal?.mode === 'create') {
            if (!user) return;
            const result = await createWorkspace(user.id, buildInput(data));
            if (result.success && result.workspace) {
                setModal(null);
                // Activa o novo workspace mas permanece nas configurações.
                navigate(workspacePath(result.workspace.id, 'settings'));
            }
            return;
        }

        if (modal?.mode === 'edit' && modal.workspace) {
            const result = await updateWorkspace(
                modal.workspace.id,
                buildInput(data)
            );
            if (result.success) {
                setModal(null);
            }
        }
    };

    const initialData =
        modal?.mode === 'edit' && modal.workspace
            ? {
                  name: modal.workspace.name,
                  sector: modal.workspace.sector ?? undefined,
                  website: modal.workspace.website ?? undefined,
                  description: modal.workspace.description ?? undefined,
                  voiceTone: modal.workspace.voiceTone ?? undefined,
                  targetAudience: modal.workspace.targetAudience ?? undefined,
                  valueProposition:
                      modal.workspace.valueProposition ?? undefined,
                  contentLanguage: modal.workspace.contentLanguage,
                  valueRatio: modal.workspace.valueRatio ?? 70,
              }
            : undefined;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        Workspaces
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Gerir os workspaces a que tem acesso. O workspace
                        activo fica destacado.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                    <Plus className="h-4 w-4" />
                    Adicionar workspace
                </button>
            </div>

            {isLoading && workspaces.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center text-sm text-gray-500">
                    A carregar workspaces...
                </div>
            ) : workspaces.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
                    <Building2 className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-3 text-sm text-gray-500">
                        Ainda não tens workspaces. Cria o primeiro para
                        começar.
                    </p>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                    >
                        <Plus className="h-4 w-4" />
                        Criar workspace
                    </button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    {workspaces.map((workspace) => (
                        <WorkspaceCard
                            key={workspace.id}
                            workspace={workspace}
                            isActive={workspace.id === currentWorkspace?.id}
                            onSelect={() => handleEnter(workspace)}
                            onEdit={() => openEdit(workspace)}
                        />
                    ))}
                </div>
            )}

            <WorkspaceFormModal
                key={
                    modal
                        ? `${modal.mode}-${modal.workspace?.id ?? 'new'}`
                        : 'closed'
                }
                isOpen={modal !== null}
                onClose={closeModal}
                title={
                    modal?.mode === 'edit'
                        ? 'Editar workspace'
                        : 'Criar novo workspace'
                }
                submitLabel={
                    modal?.mode === 'edit'
                        ? 'Guardar alterações'
                        : 'Criar workspace'
                }
                initialData={initialData}
                isLoading={isLoading}
                error={error}
                onSubmit={handleSubmit}
            />
        </div>
    );
}