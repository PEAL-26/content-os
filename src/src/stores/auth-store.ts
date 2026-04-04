import { authService, type AuthResult } from '@/services/auth.service'
import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'

interface AuthState {
    user: User | null
    session: Session | null
    isLoading: boolean
    error: string | null
    signIn: (email: string, password: string) => Promise<AuthResult>
    signUp: (
        name: string,
        email: string,
        password: string
    ) => Promise<AuthResult>
    signOut: () => Promise<void>
    clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    isLoading: true,
    error: null,

    signIn: async (email: string, password: string) => {
        set({ isLoading: true, error: null })

        const result = await authService.signIn(email, password)

        if (!result.success) {
            set({ isLoading: false, error: result.error })
            return result
        }

        set({
            user: result.user,
            session: result.session,
            isLoading: false,
            error: null,
        })

        return { success: true }
    },

    signUp: async (name: string, email: string, password: string) => {
        set({ isLoading: true, error: null })

        const result = await authService.signUp(name, email, password)

        if (!result.success) {
            set({ isLoading: false, error: result.error })
            return result
        }

        set({
            user: result.user,
            isLoading: false,
            error: null,
        })

        return { success: true }
    },

    signOut: async () => {
        set({ isLoading: true })
        await authService.signOut()
        set({ user: null, session: null, isLoading: false, error: null })
    },

    clearError: () => set({ error: null }),
}))

export function initializeAuth() {
    useAuthStore.setState({ isLoading: true })

    authService.getSession().then((session) => {
        useAuthStore.setState({
            session,
            user: session?.user ?? null,
            isLoading: false,
        })
    })

    return authService.onAuthStateChange((session) => {
        useAuthStore.setState({
            session,
            user: session?.user ?? null,
        })
    })
}
