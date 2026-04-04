import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface AuthState {
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

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    isLoading: true,
    error: null,

    signIn: async (email: string, password: string) => {
        set({ isLoading: true, error: null })

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            set({ isLoading: false, error: mapAuthError(error.message) })
            return { success: false, error: mapAuthError(error.message) }
        }

        set({
            user: data.user,
            session: data.session,
            isLoading: false,
            error: null,
        })

        return { success: true }
    },

    signUp: async (name: string, email: string, password: string) => {
        set({ isLoading: true, error: null })

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                },
            },
        })

        if (error) {
            set({ isLoading: false, error: mapAuthError(error.message) })
            return { success: false, error: mapAuthError(error.message) }
        }

        if (data.user) {
            await createInitialWorkspace(data.user.id, name)

            set({
                user: data.user,
                session: data.session,
                isLoading: false,
                error: null,
            })
        }

        return { success: true }
    },

    signOut: async () => {
        set({ isLoading: true })
        await supabase.auth.signOut()
        set({ user: null, session: null, isLoading: false, error: null })
    },

    clearError: () => set({ error: null }),
}))

async function createInitialWorkspace(userId: string, name: string) {
    const workspaceName = `${name}'s Workspace`
    const slug = generateSlug(name)

    const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
            name: workspaceName,
            slug,
            description: `Workspace de ${name}`,
        })
        .select()
        .single()

    if (workspaceError) {
        console.error('Erro ao criar workspace:', workspaceError)
        return
    }

    await supabase.from('workspace_members').insert({
        workspaceId: workspace.id,
        userId,
        role: 'OWNER',
    })
}

function generateSlug(name: string): string {
    const baseSlug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')

    const timestamp = Date.now().toString(36)
    return `${baseSlug}-${timestamp}`
}

function mapAuthError(message: string): string {
    const errorMap: Record<string, string> = {
        'Invalid login credentials': 'Email ou password incorretos',
        'Email not confirmed':
            'Email não confirmado. Verifique a sua caixa de entrada.',
        'User already registered': 'Este email já está registado',
        'Password should be at least 6 characters':
            'A password deve ter pelo menos 6 caracteres',
        'Unable to validate email address: invalid format':
            'Formato de email inválido',
    }

    return errorMap[message] || message
}

export function initializeAuth() {
    useAuthStore.setState({ isLoading: true })

    supabase.auth.getSession().then(({ data: { session } }) => {
        useAuthStore.setState({
            session: session,
            user: session?.user ?? null,
            isLoading: false,
        })
    })

    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
        useAuthStore.setState({
            session,
            user: session?.user ?? null,
        })
    })

    return () => {
        subscription.unsubscribe()
    }
}
