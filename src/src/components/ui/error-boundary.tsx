import { Component, type ErrorInfo, type ReactNode } from 'react';

// =============================================================================
// ErrorBoundary — rede de segurança de topo.
//
// Sem isto, um `throw` dentro de um `useEffect` (o caso que morria na página de
// peças: o realtime a add-mos um callback depois do `subscribe()`) faz o React
// desmontar a árvore inteira e o ecrã fica branco — sem mensagem, sem forma de
// recuperar sem F5. Aqui o erro aparece com o botão de recarregar.
// =============================================================================

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[ErrorBoundary] erro não tratado:', error, info);
    }

    render(): ReactNode {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
                <div className="w-full max-w-lg rounded-lg border border-red-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start gap-3">
                        <svg
                            className="mt-0.5 h-6 w-6 shrink-0 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                            />
                        </svg>
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold text-gray-900">
                                A aplicação encontrou um erro
                            </h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Algo falhou ao desenhar esta página. Recarrega
                                para continuar — se repetir, o detalhe está em
                                baixo e na consola do browser.
                            </p>
                            <pre className="mt-3 max-h-40 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs whitespace-pre-wrap text-gray-700">
                                {error.message || String(error)}
                            </pre>
                            <div className="mt-4">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                >
                                    Recarregar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
