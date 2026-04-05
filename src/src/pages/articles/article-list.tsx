import { ArticleStatusBadge } from '@/components/articles/article-status-badge'
import { PillarBadge } from '@/components/content/pillar-badge'
import { ProductSelector } from '@/components/products/product-selector'
import { Modal } from '@/components/ui/modal'
import { useArticles, type ArticlesFilters } from '@/hooks/use-articles'
import { useDebounce } from '@/hooks/use-debounce'
import { usePillars } from '@/hooks/use-pillars'
import { useProducts } from '@/hooks/use-products'
import type { CreateArticleInput } from '@/lib/schemas/article'
import type { ArticleStatus, ArticleWithRelations } from '@/types/database'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const STATUS_OPTIONS: Array<{ value: ArticleStatus | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'Todos' },
    { value: 'DRAFT', label: 'Rascunho' },
    { value: 'REVIEW', label: 'Em revisão' },
    { value: 'APPROVED', label: 'Aprovado' },
    { value: 'PUBLISHED', label: 'Publicado' },
]

function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-PT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

function ArticleCard({
    article,
    onDuplicate,
    onDelete,
}: {
    article: ArticleWithRelations
    onDuplicate: () => void
    onDelete: () => void
}) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        setIsDeleting(true)
        await onDelete()
        setShowDeleteConfirm(false)
        setIsDeleting(false)
    }

    return (
        <>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-gray-900">
                                {article.title}
                            </h3>
                            <ArticleStatusBadge
                                status={article.status}
                                size="sm"
                            />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {article.pillar && (
                                <PillarBadge
                                    pillar={article.pillar.pillar as any}
                                    size="sm"
                                />
                            )}
                            {article.product && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
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
                                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                        />
                                    </svg>
                                    {article.product.name}
                                </span>
                            )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                </svg>
                                {formatDate(article.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                                <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                    />
                                </svg>
                                {article._count?.contentPieces || 0} peças
                            </span>
                            {article.aiGenerated && (
                                <span className="flex items-center gap-1 text-purple-600">
                                    <svg
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                        />
                                    </svg>
                                    IA
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                        <Link
                            to={`/dashboard/articles/${article.id}/edit`}
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
                        </Link>
                        <button
                            onClick={onDuplicate}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Duplicar"
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
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar"
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Eliminar artigo?
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                            Esta ação não pode ser revertida. O artigo e todas
                            as suas peças de conteúdo serão eliminados.
                        </p>
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {isDeleting ? 'A eliminar...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
                Ainda não tens artigos
            </h3>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
                Cria o primeiro artigo manualmente ou gera conteúdo
                automaticamente com IA.
            </p>
            <div className="mt-6 flex gap-3">
                <button
                    onClick={onCreate}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    Criar artigo
                </button>
                <button className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
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
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                    </svg>
                    Gerar com IA
                </button>
            </div>
        </div>
    )
}

function CreateArticleModal({
    isOpen,
    onClose,
    onCreate,
    pillars,
}: {
    isOpen: boolean
    onClose: () => void
    onCreate: (
        data: CreateArticleInput
    ) => Promise<{ success: boolean; error?: string }>
    pillars: Array<{ id: string; name: string; pillar: string }>
}) {
    const [title, setTitle] = useState('')
    const [pillarId, setPillarId] = useState<string | null>(null)
    const [productId, setProductId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleCreate = async () => {
        if (!title.trim()) {
            setError('O título é obrigatório')
            return
        }

        setIsCreating(true)
        setError(null)

        const result = await onCreate({
            title: title.trim(),
            pillarId: pillarId || undefined,
            productId: productId || undefined,
        })

        setIsCreating(false)

        if (result.success) {
            setTitle('')
            setPillarId(null)
            setProductId(null)
            onClose()
        } else {
            setError(result.error || 'Erro ao criar artigo')
        }
    }

    const handleClose = () => {
        setTitle('')
        setPillarId(null)
        setProductId(null)
        setError(null)
        onClose()
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Criar artigo">
            <div className="space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Título *
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: 5 formas de automatizar o teu negócio"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Pilar de conteúdo
                    </label>
                    <select
                        value={pillarId || ''}
                        onChange={(e) => setPillarId(e.target.value || null)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="">Selecionar pilar (opcional)</option>
                        {pillars.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Produto relacionado
                    </label>
                    <ProductSelector
                        value={productId}
                        onChange={setProductId}
                        placeholder="Selecionar produto (opcional)"
                        className="w-full"
                    />
                </div>

                {error && (
                    <div className="rounded-md bg-red-50 p-3">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button
                    onClick={handleClose}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleCreate}
                    disabled={isCreating || !title.trim()}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isCreating ? (
                        <>
                            <svg
                                className="h-4 w-4 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                            </svg>
                            A criar...
                        </>
                    ) : (
                        'Criar artigo'
                    )}
                </button>
            </div>
        </Modal>
    )
}

function ArticleFilters({
    filters,
    onFilterChange,
    onClear,
}: {
    filters: ArticlesFilters
    onFilterChange: (updates: Partial<ArticlesFilters>) => void
    onClear: () => void
}) {
    const { pillars } = usePillars()
    const { activeProducts } = useProducts()
    const [searchInput, setSearchInput] = useState(filters.search)
    const debouncedSearch = useDebounce(searchInput, 300)

    const pillarOptions = useMemo(() => {
        return pillars.map((p) => ({
            id: p.id,
            name: p.name,
            pillar: p.pillar,
        }))
    }, [pillars])

    const hasActiveFilters =
        filters.status !== 'ALL' ||
        filters.pillarId !== null ||
        filters.productId !== null ||
        filters.search !== ''

    useEffect(() => {
        if (debouncedSearch !== filters.search) {
            onFilterChange({ search: debouncedSearch })
        }
    }, [debouncedSearch, filters.search, onFilterChange])

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
                <svg
                    className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                </svg>
                <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Pesquisar por título..."
                    className="w-full rounded-md border border-gray-300 py-2 pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
            </div>

            <select
                value={filters.status}
                onChange={(e) =>
                    onFilterChange({
                        status: e.target.value as ArticleStatus | 'ALL',
                    })
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
                {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>

            <select
                value={filters.pillarId || ''}
                onChange={(e) =>
                    onFilterChange({ pillarId: e.target.value || null })
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
                <option value="">Todos os pilares</option>
                {pillarOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.name}
                    </option>
                ))}
            </select>

            <select
                value={filters.productId || ''}
                onChange={(e) =>
                    onFilterChange({ productId: e.target.value || null })
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
                <option value="">Todos os produtos</option>
                {activeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.name}
                    </option>
                ))}
            </select>

            {hasActiveFilters && (
                <button
                    onClick={onClear}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                    Limpar filtros
                </button>
            )}
        </div>
    )
}

function ArticleListContent({
    filters,
    onFilterChange,
    onClearFilters,
    pillarOptions,
}: {
    filters: ArticlesFilters
    onFilterChange: (updates: Partial<ArticlesFilters>) => void
    onClearFilters: () => void
    pillarOptions: Array<{ id: string; name: string; pillar: string }>
}) {
    const navigate = useNavigate()
    const {
        articles,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        createArticle,
        duplicateArticle,
        deleteArticle,
    } = useArticles({ filters })

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [actionFeedback, setActionFeedback] = useState<{
        type: 'success' | 'error'
        message: string
    } | null>(null)

    const handleCreate = async (data: CreateArticleInput) => {
        const result = await createArticle(data)
        if (result.success && result.articleId) {
            navigate(`/dashboard/articles/${result.articleId}/edit`)
        }
        return result
    }

    const handleDuplicate = async (id: string) => {
        const result = await duplicateArticle(id)
        if (result.success) {
            setActionFeedback({ type: 'success', message: 'Artigo duplicado!' })
            setTimeout(() => setActionFeedback(null), 3000)
        } else {
            setActionFeedback({
                type: 'error',
                message: result.error || 'Erro ao duplicar',
            })
            setTimeout(() => setActionFeedback(null), 3000)
        }
    }

    const handleDelete = async (id: string) => {
        const result = await deleteArticle(id)
        if (result.success) {
            setActionFeedback({ type: 'success', message: 'Artigo eliminado!' })
            setTimeout(() => setActionFeedback(null), 3000)
        } else {
            setActionFeedback({
                type: 'error',
                message: result.error || 'Erro ao eliminar',
            })
            setTimeout(() => setActionFeedback(null), 3000)
        }
    }

    if (error) {
        return (
            <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Artigos
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {articles.length} artigo
                        {articles.length !== 1 ? 's' : ''}
                        {!isLoading && hasMore && ' (mais disponíveis)'}
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    Criar artigo
                </button>
            </div>

            {actionFeedback && (
                <div
                    className={`rounded-md p-3 ${actionFeedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                >
                    <p className="text-sm">{actionFeedback.message}</p>
                </div>
            )}

            <ArticleFilters
                filters={filters}
                onFilterChange={onFilterChange}
                onClear={onClearFilters}
            />

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                </div>
            ) : articles.length === 0 ? (
                <EmptyState onCreate={() => setShowCreateModal(true)} />
            ) : (
                <>
                    <div className="space-y-3">
                        {articles.map((article) => (
                            <ArticleCard
                                key={article.id}
                                article={article}
                                onDuplicate={() => handleDuplicate(article.id)}
                                onDelete={() => handleDelete(article.id)}
                            />
                        ))}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={loadMore}
                                disabled={isLoadingMore}
                                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isLoadingMore ? (
                                    <>
                                        <svg
                                            className="h-4 w-4 animate-spin"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                            />
                                        </svg>
                                        A carregar...
                                    </>
                                ) : (
                                    'Carregar mais'
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}

            <CreateArticleModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
                pillars={pillarOptions}
            />
        </div>
    )
}

export function ArticleList() {
    const { pillars } = usePillars()

    const [status, setStatus] = useQueryState('status', {
        defaultValue: 'ALL',
        shallow: false,
    })
    const [pillarId, setPillarId] = useQueryState('pillar', {
        defaultValue: '',
        shallow: false,
    })
    const [productId, setProductId] = useQueryState('product', {
        defaultValue: '',
        shallow: false,
    })
    const [search, setSearch] = useQueryState('q', {
        defaultValue: '',
        shallow: false,
    })

    const pillarOptions = useMemo(() => {
        return pillars.map((p) => ({
            id: p.id,
            name: p.name,
            pillar: p.pillar,
        }))
    }, [pillars])

    const filters: ArticlesFilters = {
        status: (status as ArticleStatus | 'ALL') || 'ALL',
        pillarId: pillarId || null,
        productId: productId || null,
        search: search || '',
    }

    const handleFilterChange = (updates: Partial<ArticlesFilters>) => {
        if (updates.status !== undefined) setStatus(updates.status)
        if (updates.pillarId !== undefined) setPillarId(updates.pillarId || '')
        if (updates.productId !== undefined)
            setProductId(updates.productId || '')
        if (updates.search !== undefined) setSearch(updates.search)
    }

    const handleClearFilters = () => {
        setStatus('ALL')
        setPillarId('')
        setProductId('')
        setSearch('')
    }

    return (
        <ArticleListContent
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            pillarOptions={pillarOptions}
        />
    )
}
