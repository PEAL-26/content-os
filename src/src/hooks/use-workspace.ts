import { GLOBAL_PATHS } from '@/lib/workspace-paths';
import { useAuthContext } from '@/context/use-auth-context';
import { workspaceInitService } from '@/services/workspace-init.service';
import { useAIProviderStore } from '@/stores/ai-provider-store';
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
    const aiProvidersHydratedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (user && !authLoading && !hasCheckedRef.current) {
            hasCheckedRef.current = true;
            store.fetchWorkspaces(user.id);
        }

        if (!user && !authLoading) {
            hasCheckedRef.current = false;
            store.clearWorkspace();
            initializedWorkspacesRef.current.clear();
            aiProvidersHydratedRef.current.clear();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- store is stable reference
    }, [user, authLoading]);

    useEffect(() => {
        // O efeito de navegação só decide após o fetch de workspaces estar
        // concluído (hasFetched): antes disso não há informação fiável sobre
        // o nº de workspaces, e um redirect prematuro (ex.: /onboarding)
        // causaria flash e perda da página atual no reload.
        if (!user || authLoading || store.isLoading || !store.hasFetched) {
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

        // Hidrata os provedores de IA com o workspace ativo (reload e login).
        // O ref evita repetir nesta sessão e o store coalesce chamadas
        // concorrentes — nunca fica em loop.
        if (
            workspaceId &&
            !store.isLoading &&
            !aiProvidersHydratedRef.current.has(workspaceId)
        ) {
            aiProvidersHydratedRef.current.add(workspaceId);
            void useAIProviderStore.getState().hydrateProviders(workspaceId);
        }
    }, [store.currentWorkspace?.id, store.isLoading]);

    return {
        currentWorkspace: store.currentWorkspace,
        workspaces: store.workspaces,
        hasFetched: store.hasFetched,
        // Um utilizador autenticado cujos workspaces ainda não foram
        // carregados (hasFetched = false) está em loading: os guards mostram
        // o spinner em vez de decidirem redirect com dados incompletos.
        isLoading:
            authLoading ||
            (user ? store.isLoading || !store.hasFetched : false),
        error: store.error,
        fetchError: store.fetchError,
        fetchWorkspaces: store.fetchWorkspaces,
        setWorkspace: store.setWorkspace,
        createWorkspace: store.createWorkspace,
        updateWorkspace: store.updateWorkspace,
        clearWorkspace: store.clearWorkspace,
        clearError: store.clearError,
    };
}