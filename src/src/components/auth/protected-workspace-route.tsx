import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import {
    getPersistedWorkspaceId,
    useWorkspaceStore,
} from '@/stores/workspace-store';
import type { WorkspaceWithRole } from '@/types/database';
import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { LoadingScreen, WorkspaceErrorScreen } from './workspace-loading';

interface ProtectedWorkspaceRouteProps {
    children: React.ReactNode;
}

/**
 * Sincroniza o workspace activo (store + localStorage) a partir do id
 * presente no URL, mantendo o URL como fonte de verdade.
 */
function WorkspaceSyncer({ workspace }: { workspace: WorkspaceWithRole }) {
    const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

    useEffect(() => {
        setWorkspace(workspace);
    }, [workspace, setWorkspace]);

    return <LoadingScreen />;
}

export function ProtectedWorkspaceRoute({
    children,
}: ProtectedWorkspaceRouteProps) {
    const { user, isLoading: authLoading } = useAuth();
    const {
        isLoading: workspaceLoading,
        workspaces,
        fetchError,
        fetchWorkspaces,
    } = useWorkspace();
    const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const location = useLocation();

    if (authLoading) {
        return <LoadingScreen />;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (workspaceLoading) {
        return <LoadingScreen />;
    }

    if (fetchError) {
        return (
            <WorkspaceErrorScreen
                onRetry={() => fetchWorkspaces(user.id)}
            />
        );
    }

    if (workspaces.length === 0) {
        return <Navigate to="/onboarding" state={{ from: location }} replace />;
    }

    const target = workspaceId
        ? (workspaces.find((w) => w.id === workspaceId) ?? null)
        : null;

    if (!target) {
        // Id inválido ou ausente → workspace activo (persistido ou o primeiro).
        const fallback =
            workspaces.find((w) => w.id === getPersistedWorkspaceId()) ??
            workspaces[0];
        return (
            <Navigate to={`/${fallback.id}/dashboard`} state={{ from: location }} replace />
        );
    }

    if (currentWorkspace?.id !== target.id) {
        return <WorkspaceSyncer workspace={target} />;
    }

    return <>{children}</>;
}