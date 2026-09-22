/**
 * Estados de carregamento/erro partilhados pela autenticação e pelos guards
 * de workspace. Centraliza o visual do spinner e da tela de erro com retry
 * para evitar duplicação e garantir consistência.
 */

export function LoadingScreen() {
    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
    );
}

interface WorkspaceErrorScreenProps {
    onRetry: () => void;
}

export function WorkspaceErrorScreen({
    onRetry,
}: WorkspaceErrorScreenProps) {
    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
                <p className="text-sm font-medium text-gray-700">
                    Não foi possível carregar os seus workspaces.
                </p>
                <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                    Tentar novamente
                </button>
            </div>
        </div>
    );
}