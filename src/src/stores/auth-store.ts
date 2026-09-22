import { authService, type AuthResult } from '@/services/auth.service';
import { useAIProviderStore } from '@/stores/ai-provider-store';
import { getPersistedWorkspaceId } from '@/stores/workspace-store';
import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<AuthResult>;
    signUp: (
        name: string,
        email: string,
        password: string
    ) => Promise<AuthResult>;
    signOut: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    isLoading: true,
    error: null,

    signIn: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        const result = await authService.signIn(email, password);

        if (!result.success) {
            set({ isLoading: false, error: result.error });
            return result;
        }

        set({
            user: result.user,
            session: result.session,
            isLoading: false,
            error: null,
        });

        // Recarrega os provedores de IA (e chaves) com a sessão ativa.
        // Sem password — as chaves ficam logo acessíveis.
        if (result.user) {
            const providerStore = useAIProviderStore.getState();
            void providerStore.unlock(password);
        }

        return { success: true };
    },

    signUp: async (name: string, email: string, password: string) => {
        set({ isLoading: true, error: null });

        const result = await authService.signUp(name, email, password);

        if (!result.success) {
            set({ isLoading: false, error: result.error });
            return result;
        }

        set({
            user: result.user,
            isLoading: false,
            error: null,
        });

        return { success: true };
    },

    signOut: async () => {
        set({ isLoading: true });
        await authService.signOut();
        // Descarta os dados de IA em memória (chaves, providers)
        useAIProviderStore.getState().lock();
        set({ user: null, session: null, isLoading: false, error: null });
    },

    clearError: () => set({ error: null }),
}));

export function initializeAuth() {
    useAuthStore.setState({ isLoading: true });

    authService.getSession().then((session) => {
        useAuthStore.setState({
            session,
            user: session?.user ?? null,
            isLoading: false,
        });

        // Hidrata os provedores de IA na restauração da sessão, para que a
        // geração funcione logo após um reload sem visitar as definições.
        // Usa o workspace persistido (se existir) para carregar também o
        // provedor/modelo padrão e as chaves.
        if (session?.user) {
            const persistedWorkspaceId = getPersistedWorkspaceId();
            void useAIProviderStore
                .getState()
                .hydrateProviders(persistedWorkspaceId ?? undefined);
        }
    });

    return authService.onAuthStateChange((session) => {
        useAuthStore.setState({
            session,
            user: session?.user ?? null,
        });
    });
}
