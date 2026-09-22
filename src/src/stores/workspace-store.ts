import {
    workspaceService,
    type CreateWorkspaceInput,
    type UpdateWorkspaceInput,
    type Workspace,
    type WorkspaceWithRole,
} from '@/services/workspace.service';
import { create } from 'zustand';

interface WorkspaceState {
    currentWorkspace: Workspace | null;
    workspaces: WorkspaceWithRole[];
    isLoading: boolean;
    hasFetched: boolean;
    /** Erro de uma operação (criar/editar workspace) — mostrado nos forms. */
    error: string | null;
    /** Erro do fetch inicial de workspaces — usado pelos guards de rota. */
    fetchError: string | null;

    fetchWorkspaces: (userId: string) => Promise<void>;
    setWorkspace: (workspace: Workspace) => void;
    createWorkspace: (
        userId: string,
        input: CreateWorkspaceInput
    ) => Promise<{
        success: boolean;
        error?: string;
        workspace?: Workspace;
    }>;
    updateWorkspace: (
        workspaceId: string,
        input: UpdateWorkspaceInput
    ) => Promise<{ success: boolean; error?: string }>;
    clearWorkspace: () => void;
    clearError: () => void;
}

export const ACTIVE_WORKSPACE_KEY = 'contentos-active-workspace';

export function getPersistedWorkspaceId(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    currentWorkspace: null,
    workspaces: [],
    isLoading: false,
    hasFetched: false,
    error: null,
    fetchError: null,

    fetchWorkspaces: async (userId: string) => {
        if (get().hasFetched && get().workspaces.length > 0) {
            return;
        }

        set({ isLoading: true, error: null, fetchError: null });

        try {
            const workspaces =
                await workspaceService.getWorkspacesByUser(userId);

            const persistedId = getPersistedWorkspaceId();
            const persistedWorkspace = persistedId
                ? (workspaces.find((w) => w.id === persistedId) ?? null)
                : null;

            set({
                workspaces,
                currentWorkspace: persistedWorkspace,
                isLoading: false,
                hasFetched: true,
            });
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar workspaces';
            // Fetch error é guardado à parte: os guards de rota usam este
            // campo para decidir se mostram a ecrã de erro. Misturá-lo com o
            // `error` das operações fazia o ProtectedWorkspaceRoute desmontar
            // a página (e o modal) logo que uma operação falhasse.
            set({ isLoading: false, fetchError: error, hasFetched: true });
        }
    },

    setWorkspace: (workspace: Workspace) => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
        }
        set({ currentWorkspace: workspace });
    },

    createWorkspace: async (userId: string, input: CreateWorkspaceInput) => {
        set({ isLoading: true, error: null });

        try {
            const { workspaceId } = await workspaceService.createWorkspace(
                userId,
                input
            );

            const workspace: Workspace = {
                id: workspaceId,
                name: input.name,
                slug: workspaceService.generateSlug(input.name),
                description: input.description ?? null,
                logoUrl: null,
                sector: input.sector ?? null,
                website: input.website ?? null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                voiceTone: input.voiceTone ?? null,
                targetAudience: input.targetAudience ?? null,
                contentLanguage: input.contentLanguage ?? 'pt',
                valueProposition: input.valueProposition ?? null,
                valueRatio: input.valueRatio ?? 70,
                productRatio: input.productRatio ?? 30,
                postsPerWeek: 3,
                articlesPerWeek: 1,
            };

            const workspacesWithRole: WorkspaceWithRole = {
                ...workspace,
                memberRole: 'OWNER',
                joinedAt: new Date().toISOString(),
                memberCount: 1,
            };
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
            }
            set({
                workspaces: [...get().workspaces, workspacesWithRole],
                currentWorkspace: workspace,
                isLoading: false,
            });
            return { success: true, workspace };
        } catch (err) {
            const error =
                err instanceof Error ? err.message : 'Erro ao criar workspace';
            set({ isLoading: false, error });
            return { success: false, error };
        }
    },

    updateWorkspace: async (
        workspaceId: string,
        input: UpdateWorkspaceInput
    ) => {
        set({ isLoading: true, error: null });

        try {
            const workspace = await workspaceService.updateWorkspace(
                workspaceId,
                input
            );

            const workspaces = get().workspaces.map((w) =>
                w.id === workspaceId ? { ...w, ...workspace } : w
            );

            set({
                workspaces,
                currentWorkspace:
                    get().currentWorkspace?.id === workspaceId
                        ? workspace
                        : get().currentWorkspace,
                isLoading: false,
            });

            return { success: true };
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao atualizar workspace';
            set({ isLoading: false, error });
            return { success: false, error };
        }
    },

    clearWorkspace: () => {
        set({
            currentWorkspace: null,
            workspaces: [],
            error: null,
            hasFetched: false,
        });
    },

    clearError: () => {
        set({ error: null });
    },
}));
