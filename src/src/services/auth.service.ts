import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthResult {
    success: boolean;
    error?: string;
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
    };

    return errorMap[message] || message;
}

export const authService = {
    async signIn(
        email: string,
        password: string
    ): Promise<{ session: Session | null; user: User | null } & AuthResult> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return {
                success: false,
                error: mapAuthError(error.message),
                session: null,
                user: null,
            };
        }

        return {
            success: true,
            session: data.session,
            user: data.user,
        };
    },

    async signUp(
        name: string,
        email: string,
        password: string
    ): Promise<{ user: User | null } & AuthResult> {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                },
            },
        });

        if (error) {
            return {
                success: false,
                error: mapAuthError(error.message),
                user: null,
            };
        }

        return {
            success: true,
            user: data.user,
        };
    },

    async signOut(): Promise<void> {
        await supabase.auth.signOut();
    },

    async getSession(): Promise<Session | null> {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        return session;
    },

    onAuthStateChange(callback: (session: Session | null) => void) {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            callback(session);
        });

        return () => {
            subscription.unsubscribe();
        };
    },
};
