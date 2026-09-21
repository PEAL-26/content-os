import { WorkspaceCard } from '@/components/workspace/workspace-card';
import { useAuthContext } from '@/context/use-auth-context';
import { useWorkspace } from '@/hooks/use-workspace';
import { Plus, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function WorkspacesPage() {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const {
        workspaces,
        currentWorkspace,
        isLoading,
        error,
        setWorkspace,
        fetchWorkspaces,
    } = useWorkspace();

    useEffect(() => {
        if (isLoading) return;

        if (workspaces.length === 0) {
            navigate('/onboarding', { replace: true });
        } else if (workspaces.length === 1) {
            navigate('/dashboard', { replace: true });
        }
    }, [isLoading, workspaces.length, navigate]);

    const handleSelect = (workspaceId: string) => {
        const workspace = workspaces.find((w) => w.id === workspaceId);
        if (!workspace) return;

        setWorkspace(workspace);
        navigate('/dashboard');
    };

    const handleRetry = () => {
        if (user) {
            fetchWorkspaces(user.id);
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            <div className="mx-auto w-full max-w-5xl px-4 py-12">
                <div className="flex items-center justify-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 to-indigo-600">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <h1 className="text-lg font-bold text-gray-900">
                        ContentOS
                    </h1>
                </div>

                <div className="mt-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">
                            Escolhe um workspace
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Selecciona o espaço de trabalho onde queres
                            continuar
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/onboarding')}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        <Plus className="h-4 w-4" />
                        Criar novo workspace
                    </button>
                </div>

                {isLoading ? (
                    <div className="mt-20 flex justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                    </div>
                ) : error ? (
                    <div className="mt-10 rounded-md bg-red-50 p-4">
                        <p className="text-sm text-red-800">{error}</p>
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500"
                        >
                            Tentar novamente
                        </button>
                    </div>
                ) : (
                    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {workspaces.map((workspace) => (
                            <WorkspaceCard
                                key={workspace.id}
                                workspace={workspace}
                                isActive={
                                    workspace.id === currentWorkspace?.id
                                }
                                onSelect={() => handleSelect(workspace.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}