import { GLOBAL_PATHS } from '@/lib/workspace-paths';
import { useAuthContext } from '@/context/use-auth-context';
import { workspaceInitService } from '@/services/workspace-init.service';
import {
    getPersistedWorkspaceId,
    useWorkspaceStore,
} from '@/stores/workspace-store';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useWorkspace() {
    const { user, isLoading: authLoading } = useAuthContext();
    const navigate = useNavigate();
    const location = useLocation();
    const store = useWorkspaceStore();
    const hasCheckedRef = useRef(false);
    const initializedWorkspacesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (user && !authLoading && !hasCheckedRef.current) {
            hasCheckedRef.current = true;
            store.fetchWorkspaces(user.id);
        }

        if (!user && !authLoading) {
            hasCheckedRef.current = false;
            store.clearWorkspace();
            initializedWorkspacesRef.current.clear();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- store is stable reference
    }, [user, authLoading]);

    useEffect(() => {
        if (!user || authLoading || store.isLoading) {
            return;
        }

        const pathname = location.pathname;
        const isOnboarding = pathname === '/onboarding';

        // Onboarding destina-se apenas a novos registos (0 workspaces).
        // Um utilizador existente que aterrize lá vai para o workspace activo.
        if (isOnboarding) {
            if (store.workspaces.length > 0) {
                const preferred =
                    store.currentWorkspace ??
                    store.workspaces.find(
                        (w) => w.id === getPersistedWorkspaceId()
                    ) ??
                    store.workspaces[0];
                navigate(`/${preferred.id}/dashboard`, { replace: true });
            }
            return;
        }

        // Já dentro de uma rota de workspace válida → o guard trata do resto.
        const firstSegment = pathname.split('/')[1];
        if (
            firstSegment &&
            store.workspaces.some((w) => w.id === firstSegment)
        ) {
            return;
        }

        // Páginas globais (login/register/settings de conta) → nada a fazer.
        if (
            GLOBAL_PATHS.some(
                (p) => pathname === p || pathname.startsWith(`${p}/`)
            )
        ) {
            return;
        }

        // Landing (raiz ou caminhos antigos) → decidir pelo nº de workspaces.
        if (store.workspaces.length === 0) {
            navigate('/onboarding', { replace: true });
            return;
        }

        const preferred =
            store.currentWorkspace ??
            store.workspaces.find(
                (w) => w.id === getPersistedWorkspaceId()
            ) ??
            store.workspaces[0];

        navigate(`/${preferred.id}/dashboard`, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- store is stable reference
    }, [
        user,
        authLoading,
        store.isLoading,
        store.workspaces.length,
        store.currentWorkspace?.id,
        location.pathname,
        navigate,
    ]);

    useEffect(() => {
        const workspaceId = store.currentWorkspace?.id;

        if (
            workspaceId &&
            !initializedWorkspacesRef.current.has(workspaceId) &&
            !store.isLoading
        ) {
            initializedWorkspacesRef.current.add(workspaceId);
            workspaceInitService.ensureDefaultConfigs(workspaceId);
        }
    }, [store.currentWorkspace?.id, store.isLoading]);

    return {
        currentWorkspace: store.currentWorkspace,
        workspaces: store.workspaces,
        isLoading: store.isLoading || authLoading,
        error: store.error,
        fetchWorkspaces: store.fetchWorkspaces,
        setWorkspace: store.setWorkspace,
        createWorkspace: store.createWorkspace,
        updateWorkspace: store.updateWorkspace,
        clearWorkspace: store.clearWorkspace,
        clearError: store.clearError,
    };
}