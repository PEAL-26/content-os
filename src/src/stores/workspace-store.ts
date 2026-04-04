import {
    workspaceService,
    type CreateWorkspaceInput,
    type UpdateWorkspaceInput,
    type Workspace,
    type WorkspaceWithRole,
} from '@/services/workspace.service'
import { create } from 'zustand'

interface WorkspaceState {
    currentWorkspace: Workspace | null
    workspaces: WorkspaceWithRole[]
    isLoading: boolean
    hasFetched: boolean
    error: string | null

    fetchWorkspaces: (userId: string) => Promise<void>
    setWorkspace: (workspace: Workspace) => void
    createWorkspace: (
        userId: string,
        input: CreateWorkspaceInput
    ) => Promise<{
        success: boolean
        error?: string
        workspace?: Workspace
    }>
    updateWorkspace: (
        workspaceId: string,
        input: UpdateWorkspaceInput
    ) => Promise<{ success: boolean; error?: string }>
    clearWorkspace: () => void
    clearError: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    currentWorkspace: null,
    workspaces: [],
    isLoading: false,
    hasFetched: false,
    error: null,

    fetchWorkspaces: async (userId: string) => {
        if (get().hasFetched && get().workspaces.length > 0) {
            return
        }

        set({ isLoading: true, error: null })

        try {
            const workspaces =
                await workspaceService.getWorkspacesByUser(userId)
            set({
                workspaces,
                currentWorkspace: workspaces[0] ?? null,
                isLoading: false,
                hasFetched: true,
            })
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar workspaces'
            set({ isLoading: false, error, hasFetched: true })
        }
    },

    setWorkspace: (workspace: Workspace) => {
        set({ currentWorkspace: workspace })
    },

    createWorkspace: async (userId: string, input: CreateWorkspaceInput) => {
        set({ isLoading: true, error: null })

        try {
            const { workspaceId } = await workspaceService.createWorkspace(
                userId,
                input
            )

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
            }

            const workspacesWithRole: WorkspaceWithRole = {
                ...workspace,
                memberRole: 'OWNER',
            }
            set({
                workspaces: [...get().workspaces, workspacesWithRole],
                currentWorkspace: workspace,
                isLoading: false,
            })
            return { success: true, workspace }
        } catch (err) {
            const error =
                err instanceof Error ? err.message : 'Erro ao criar workspace'
            set({ isLoading: false, error })
            return { success: false, error }
        }
    },

    updateWorkspace: async (
        workspaceId: string,
        input: UpdateWorkspaceInput
    ) => {
        set({ isLoading: true, error: null })

        try {
            const workspace = await workspaceService.updateWorkspace(
                workspaceId,
                input
            )

            const workspaces = get().workspaces.map((w) =>
                w.id === workspaceId ? { ...w, ...workspace } : w
            )

            set({
                workspaces,
                currentWorkspace:
                    get().currentWorkspace?.id === workspaceId
                        ? workspace
                        : get().currentWorkspace,
                isLoading: false,
            })

            return { success: true }
        } catch (err) {
            const error =
                err instanceof Error
                    ? err.message
                    : 'Erro ao atualizar workspace'
            set({ isLoading: false, error })
            return { success: false, error }
        }
    },

    clearWorkspace: () => {
        set({ currentWorkspace: null, workspaces: [], error: null, hasFetched: false })
    },

    clearError: () => {
        set({ error: null })
    },
}))
