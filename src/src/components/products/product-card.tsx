import type { Product } from '@/types/database'

interface ProductCardProps {
    product: Product
    onEdit: () => void
    onArchive: () => void
}

export function ProductCard({ product, onEdit, onArchive }: ProductCardProps) {
    return (
        <div
            className={`rounded-lg border bg-white p-4 shadow-sm transition-all ${
                product.isActive
                    ? 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    : 'border-gray-200 bg-gray-50 opacity-75'
            }`}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-gray-900">
                            {product.name}
                        </h3>
                        <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                product.isActive
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                            }`}
                        >
                            {product.isActive ? 'Ativo' : 'Arquivado'}
                        </span>
                    </div>

                    {product.tagline && (
                        <p className="mt-1 truncate text-sm text-gray-500">
                            {product.tagline}
                        </p>
                    )}

                    {product.targetAudience && (
                        <p className="mt-2 text-xs text-gray-400">
                            <span className="font-medium">Público:</span>{' '}
                            {product.targetAudience}
                        </p>
                    )}

                    {product.landingUrl && (
                        <a
                            href={product.landingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                            <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                            </svg>
                            Landing page
                        </a>
                    )}
                </div>

                <div className="ml-4 flex flex-shrink-0 items-center gap-1">
                    <button
                        onClick={onEdit}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Editar"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                        </svg>
                    </button>
                    <button
                        onClick={onArchive}
                        className={`rounded-md p-1.5 ${
                            product.isActive
                                ? 'text-orange-500 hover:bg-orange-50 hover:text-orange-600'
                                : 'text-green-500 hover:bg-green-50 hover:text-green-600'
                        }`}
                        title={product.isActive ? 'Arquivar' : 'Ativar'}
                    >
                        {product.isActive ? (
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                />
                            </svg>
                        ) : (
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {product.problemSolved && (
                <div className="mt-3 rounded-md bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">
                            Problema que resolve:
                        </span>{' '}
                        {product.problemSolved.length > 100
                            ? `${product.problemSolved.substring(0, 100)}...`
                            : product.problemSolved}
                    </p>
                </div>
            )}
        </div>
    )
}
