import { useAuth } from '@/hooks/use-auth'
import { useWorkspace } from '@/hooks/use-workspace'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedWorkspaceRouteProps {
    children: React.ReactNode
}

export function ProtectedWorkspaceRoute({
    children,
}: ProtectedWorkspaceRouteProps) {
    const { user, isLoading: authLoading } = useAuth()
    const { isLoading: workspaceLoading, workspaces } = useWorkspace()
    const location = useLocation()

    const isLoading = authLoading || workspaceLoading

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (!workspaceLoading && workspaces.length === 0) {
        return <Navigate to="/onboarding" state={{ from: location }} replace />
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        )
    }

    return <>{children}</>
}
