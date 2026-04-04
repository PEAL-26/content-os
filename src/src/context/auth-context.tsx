import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, type ReactNode } from 'react'
import { initializeAuth, useAuthStore } from '../stores/auth-store'

interface AuthContextValue {
    user: User | null
    session: Session | null
    isLoading: boolean
    error: string | null
    signIn: (
        email: string,
        password: string
    ) => Promise<{ success: boolean; error?: string }>
    signUp: (
        name: string,
        email: string,
        password: string
    ) => Promise<{ success: boolean; error?: string }>
    signOut: () => Promise<void>
    clearError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const store = useAuthStore()

    const value: AuthContextValue = {
        user: store.user,
        session: store.session,
        isLoading: store.isLoading,
        error: store.error,
        signIn: store.signIn,
        signUp: store.signUp,
        signOut: store.signOut,
        clearError: store.clearError,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider')
    }
    return context
}

export { initializeAuth }
