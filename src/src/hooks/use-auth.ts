import { useAuthContext } from '@/context/use-auth-context';

export function useAuth() {
    return useAuthContext();
}
