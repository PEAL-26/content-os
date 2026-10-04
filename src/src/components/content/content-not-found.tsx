import { workspacePath } from '@/lib/workspace-paths';
import { Link } from 'react-router-dom';

interface ContentNotFoundProps {
    workspaceId: string;
    /** Caminho dentro do workspace; por omissão, a lista de peças. */
    backTo?: string;
    backLabel?: string;
    message?: string;
    onRetry?: () => void;
}

/**
 * Estado "não encontrado"/erro das páginas de detalhe, com link de volta.
 * Preferimos isto a um redirect para a lista: um link guardado ou partilhado
 * mantém-se legível, e o motivo do erro fica visível.
 *
 * Vive num componente próprio (e não na página de peça) porque as duas páginas
 * de detalhe o usam — e o "voltar" é um `<Link>` a sério, para que o
 * middle-click, o ctrl-click e "abrir num separador novo" funcionem.
 */
export function ContentNotFound({
    workspaceId,
    backTo,
    backLabel = 'Voltar',
    message,
    onRetry,
}: ContentNotFoundProps) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg
                    className="h-8 w-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                    />
                </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
                Não encontrado
            </h2>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
                {message ||
                    'O conteúdo que procuras não existe ou foi eliminado.'}
            </p>
            <div className="mt-4 flex gap-3">
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Tentar novamente
                    </button>
                )}
                <Link
                    to={workspacePath(workspaceId, backTo ?? 'content')}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                    {backLabel}
                </Link>
            </div>
        </div>
    );
}