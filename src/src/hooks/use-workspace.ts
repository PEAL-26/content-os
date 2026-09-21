import { useAuthContext } from '@/context/use-auth-context';
import { workspaceInitService } from '@/services/workspace-init.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
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

        // 0 workspaces → onboarding (criar o primeiro)
        if (store.workspaces.length === 0) {
            navigate('/onboarding', { replace: true });
            return;
        }

        // 1 workspace → activar automaticamente
        if (store.workspaces.length === 1) {
            const single = store.workspaces[0];
            if (store.currentWorkspace?.id !== single.id) {
                store.setWorkspace(single);
            }
            if (
                location.pathname === '/workspaces' ||
                location.pathname === '/'
            ) {
                navigate('/dashboard', { replace: true });
            }
            return;
        }

        // 2+ workspaces → forçar escolha quando não há workspace activo
        if (!store.currentWorkspace && location.pathname !== '/workspaces') {
            navigate('/workspaces', { replace: true });
        }
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
    };
}
