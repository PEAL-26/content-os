import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../context/use-auth-context';
import { LoadingScreen } from './workspace-loading';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, isLoading } = useAuthContext();
    const location = useLocation();

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
