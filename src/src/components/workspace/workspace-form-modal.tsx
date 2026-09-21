import { Modal } from '@/components/ui/modal';
import type { CreateWorkspaceFormData } from '@/lib/schemas/workspace';
import { useWorkspaceForm, WorkspaceFormFields } from './workspace-form';

interface WorkspaceFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    submitLabel: string;
    /** Valores pré-preenchidos (edição). */
    initialData?: Partial<CreateWorkspaceFormData>;
    isLoading: boolean;
    error: string | null;
    onSubmit: (data: CreateWorkspaceFormData) => void | Promise<void>;
}

/**
 * Modal para criar ou editar um workspace, reutilizando o formulário
 * partilhado de workspace.
 */
export function WorkspaceFormModal({
    isOpen,
    onClose,
    title,
    submitLabel,
    initialData,
    isLoading,
    error,
    onSubmit,
}: WorkspaceFormModalProps) {
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
            <div className="px-6 pb-6">
                <div className="max-h-[65vh] overflow-y-auto pr-1">
                    <WorkspaceFormModalBody
                        initialData={initialData}
                        submitLabel={submitLabel}
                        isLoading={isLoading}
                        error={error}
                        onSubmit={onSubmit}
                        onClose={onClose}
                    />
                </div>
            </div>
        </Modal>
    );
}

function WorkspaceFormModalBody({
    initialData,
    submitLabel,
    isLoading,
    error,
    onSubmit,
    onClose,
}: {
    initialData?: Partial<CreateWorkspaceFormData>;
    submitLabel: string;
    isLoading: boolean;
    error: string | null;
    onSubmit: (data: CreateWorkspaceFormData) => void | Promise<void>;
    onClose: () => void;
}) {
    const form = useWorkspaceForm(initialData);

    return (
        <form
            onSubmit={form.handleSubmit((data) => void onSubmit(data))}
            className="space-y-6 pt-2"
        >
            {error && (
                <div className="rounded-md bg-red-50 p-4">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            <WorkspaceFormFields form={form} />

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading ? (
                        <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            A guardar...
                        </span>
                    ) : (
                        submitLabel
                    )}
                </button>
            </div>
        </form>
    );
}