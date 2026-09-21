import {
    WorkspaceFormFields,
    useWorkspaceForm,
} from '@/components/workspace/workspace-form';
import { useAuthContext } from '@/context/use-auth-context';
import { useWorkspace } from '@/hooks/use-workspace';
import type { CreateWorkspaceFormData } from '@/lib/schemas/workspace';
import { useNavigate } from 'react-router-dom';

export function CreateWorkspacePage() {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const { createWorkspace, isLoading, error } = useWorkspace();

    const form = useWorkspaceForm();

    const onSubmit = async (formData: CreateWorkspaceFormData) => {
        if (!user) return;

        const result = await createWorkspace(user.id, {
            name: formData.name,
            description: formData.description,
            sector: formData.sector,
            website: formData.website || undefined,
            voiceTone: formData.voiceTone,
            targetAudience: formData.targetAudience,
            valueProposition: formData.valueProposition,
            contentLanguage: formData.contentLanguage,
            valueRatio: formData.valueRatio,
            productRatio: 100 - (formData.valueRatio ?? 70),
        });

        if (result.success && result.workspace) {
            navigate(`/${result.workspace.id}/dashboard`, { replace: true });
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
            <div className="w-full max-w-2xl">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Configurar Workspace
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Configure o seu espaço de trabalho para começar a criar
                        conteúdo
                    </p>
                </div>

                <div className="mt-8 bg-white px-6 py-8 shadow-xl ring-1 ring-gray-900/5 sm:px-8">
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <p className="text-sm text-red-800">
                                    {error}
                                </p>
                            </div>
                        )}

                        <WorkspaceFormFields form={form} />

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex w-full justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    A criar workspace...
                                </span>
                            ) : (
                                'Criar Workspace'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}