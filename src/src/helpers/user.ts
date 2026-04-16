import type { User } from '@supabase/supabase-js';

export interface UserInfo {
    name: string;
    initial: string;
    email?: string;
}

export function getUserDisplayName(user: User | null): string {
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utilizador';
}

export function getUserInitial(user: User | null): string {
    return getUserDisplayName(user).charAt(0).toUpperCase();
}

export function getUserInfo(user: User | null): UserInfo {
    return {
        name: getUserDisplayName(user),
        initial: getUserInitial(user),
        email: user?.email,
    };
}
