import { useAuthContext } from '@/context/auth-context'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export function useWorkspace() {
    const { user, isLoading: authLoading } = useAuthContext()
    const navigate = useNavigate()
    const store = useWorkspaceStore()
    const hasCheckedRef = useRef(false)

    useEffect(() => {
        if (user && !authLoading && !hasCheckedRef.current) {
            hasCheckedRef.current = true
            store.fetchWorkspaces(user.id)
        }

        if (!user && !authLoading) {
            hasCheckedRef.current = false
            store.clearWorkspace()
        }
    }, [user, authLoading])

    useEffect(() => {
        if (
            !store.isLoading &&
            store.workspaces.length === 0 &&
            user &&
            !authLoading
        ) {
            navigate('/onboarding', { replace: true })
        }
    }, [store.isLoading, store.workspaces.length, user, authLoading, navigate])

    return {
        currentWorkspace: store.currentWorkspace,
        workspaces: store.workspaces,
        isLoading: store.isLoading || authLoading,
        error: store.error,
        setWorkspace: store.setWorkspace,
        createWorkspace: store.createWorkspace,
        updateWorkspace: store.updateWorkspace,
        clearWorkspace: store.clearWorkspace,
    }
}
