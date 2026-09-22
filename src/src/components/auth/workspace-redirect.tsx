import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { getPersistedWorkspaceId } from '@/stores/workspace-store';
import { Navigate } from 'react-router-dom';
import { LoadingScreen, WorkspaceErrorScreen } from './workspace-loading';

/**
 * Landing para a raiz ("/"): decide o destino com base no nº de workspaces
 * do utilizador autenticado.
 *   - 0  → onboarding (criar o primeiro workspace)
 *   - 1+ → dashboard do workspace persistido (ou o primeiro)
 */
export function WorkspaceRedirect() {
    const { user, isLoading: authLoading } = useAuth();
    const {
        isLoading,
        workspaces,
        fetchError,
        fetchWorkspaces,
    } = useWorkspace();

    if (authLoading || isLoading) {
        return <LoadingScreen />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (fetchError) {
        return <WorkspaceErrorScreen onRetry={() => fetchWorkspaces(user.id)} />;
    }

    if (workspaces.length === 0) {
        return <Navigate to="/onboarding" replace />;
    }

    const preferred =
        workspaces.find((w) => w.id === getPersistedWorkspaceId()) ??
        workspaces[0];

    return <Navigate to={`/${preferred.id}/dashboard`} replace />;
}