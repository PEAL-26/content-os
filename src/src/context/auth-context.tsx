import type { Session, User } from '@supabase/supabase-js';
import { createContext, type ReactNode } from 'react';
import { useAuthStore } from '../stores/auth-store';

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    error: string | null;
    signIn: (
        email: string,
        password: string
    ) => Promise<{ success: boolean; error?: string }>;
    signUp: (
        name: string,
        email: string,
        password: string
    ) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const store = useAuthStore();

    const value: AuthContextValue = {
        user: store.user,
        session: store.session,
        isLoading: store.isLoading,
        error: store.error,
        signIn: store.signIn,
        signUp: store.signUp,
        signOut: store.signOut,
        clearError: store.clearError,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
