import { useAuthContext } from '@/context/use-auth-context';
import { workspaceInitService } from '@/services/workspace-init.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export function useWorkspace() {
    const { user, isLoading: authLoading } = useAuthContext();
    const navigate = useNavigate();
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
        if (
            !store.isLoading &&
            store.workspaces.length === 0 &&
            user &&
            !authLoading
        ) {
            navigate('/onboarding', { replace: true });
        }
    }, [store.isLoading, store.workspaces.length, user, authLoading, navigate]);

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
        setWorkspace: store.setWorkspace,
        createWorkspace: store.createWorkspace,
        updateWorkspace: store.updateWorkspace,
        clearWorkspace: store.clearWorkspace,
    };
}
