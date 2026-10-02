import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/auth-context';
import { ErrorBoundary } from './components/ui/error-boundary';
import './index.css';
import { initializeAuth } from './stores/auth-store';

initializeAuth();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {/* Rede de segurança: um throw num effect (ex.: o Realtime) derrubava
            a app inteira sem isto. */}
        <ErrorBoundary>
            <AuthProvider>
                <App />
            </AuthProvider>
        </ErrorBoundary>
    </StrictMode>
);
