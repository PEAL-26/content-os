import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { getPersistedWorkspaceId } from '@/stores/workspace-store';
import { Navigate } from 'react-router-dom';

/**
 * Landing para a raiz ("/"): decide o destino com base no nº de workspaces
 * do utilizador autenticado.
 *   - 0  → onboarding (criar o primeiro workspace)
 *   - 1+ → dashboard do workspace persistido (ou o primeiro)
 */
export function WorkspaceRedirect() {
    const { user, isLoading: authLoading } = useAuth();
    const { isLoading, workspaces } = useWorkspace();

    if (authLoading || isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (workspaces.length === 0) {
        return <Navigate to="/onboarding" replace />;
    }

    const preferred =
        workspaces.find((w) => w.id === getPersistedWorkspaceId()) ??
        workspaces[0];

    return <Navigate to={`/${preferred.id}/dashboard`} replace />;
}