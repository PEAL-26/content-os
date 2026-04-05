import { ProductCard } from '@/components/products/product-card'
import { ProductForm } from '@/components/products/product-form'
import { ConfirmModal, Modal } from '@/components/ui/modal'
import { useProducts, type ProductSortBy } from '@/hooks/use-products'
import type { CreateProductInput } from '@/lib/schemas/product'
import type { Product } from '@/types/database'
import { useState } from 'react'

const sortOptions: { value: ProductSortBy; label: string }[] = [
    { value: 'createdAt', label: 'Data de criação' },
    { value: 'name', label: 'Nome' },
    { value: 'isActive', label: 'Estado' },
]

export function ProductsPage() {
    const {
        products,
        activeProducts,
        archivedProducts,
        isLoading,
        error,
        sortBy,
        sortOrder,
        setSortBy,
        setSortOrder,
        createProduct,
        updateProduct,
        toggleActive,
    } = useProducts()

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [productToArchive, setProductToArchive] = useState<Product | null>(
        null
    )
    const [isSaving, setIsSaving] = useState(false)
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

    const showFeedback = (message: string) => {
        setFeedbackMessage(message)
        setTimeout(() => setFeedbackMessage(null), 3000)
    }

    const handleOpenCreate = () => {
        setEditingProduct(null)
        setIsModalOpen(true)
    }

    const handleOpenEdit = (product: Product) => {
        setEditingProduct(product)
        setIsModalOpen(true)
    }

    const handleArchive = (product: Product) => {
        setProductToArchive(product)
        setIsConfirmModalOpen(true)
    }

    const handleConfirmArchive = async () => {
        if (!productToArchive) return

        setIsSaving(true)
        const result = await toggleActive(productToArchive.id)
        setIsSaving(false)

        if (result.success) {
            showFeedback(
                productToArchive.isActive
                    ? 'Produto arquivado com sucesso'
                    : 'Produto ativado com sucesso'
            )
        } else {
            showFeedback(result.error || 'Erro ao processar produto')
        }

        setIsConfirmModalOpen(false)
        setProductToArchive(null)
    }

    const handleSubmit = async (data: CreateProductInput) => {
        setIsSaving(true)

        let result
        if (editingProduct) {
            result = await updateProduct(editingProduct.id, data)
        } else {
            result = await createProduct(data)
        }

        setIsSaving(false)

        if (result.success) {
            showFeedback(
                editingProduct
                    ? 'Produto atualizado com sucesso'
                    : 'Produto criado com sucesso'
            )
            setIsModalOpen(false)
            setEditingProduct(null)
        } else {
            showFeedback(result.error || 'Erro ao guardar produto')
        }
    }

    const toggleSortOrder = () => {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    }

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Produtos
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Gerir os produtos da empresa para criar conteúdo
                        direcionado
                    </p>
                </div>

                <button
                    onClick={handleOpenCreate}
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
                    Novo Produto
                </button>
            </div>

            {feedbackMessage && (
                <div className="rounded-md bg-green-50 p-3">
                    <p className="flex items-center gap-2 text-sm text-green-700">
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
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        {feedbackMessage}
                    </p>
                </div>
            )}

            {error && (
                <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">
                        Ordenar por:
                    </label>
                    <select
                        value={sortBy}
                        onChange={(e) =>
                            setSortBy(e.target.value as ProductSortBy)
                        }
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                        {sortOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={toggleSortOrder}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                    {sortOrder === 'desc' ? (
                        <>
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
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                            Decrescente
                        </>
                    ) : (
                        <>
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
                                    d="M5 15l7-7 7 7"
                                />
                            </svg>
                            Crescente
                        </>
                    )}
                </button>

                <span className="text-sm text-gray-500">
                    {activeProducts.length} ativo
                    {activeProducts.length !== 1 ? 's' : ''}
                    {archivedProducts.length > 0 &&
                        ` · ${archivedProducts.length} archivado${archivedProducts.length !== 1 ? 's' : ''}`}
                </span>
            </div>

            {products.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
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
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">
                        Nenhum produto
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Comece por adicionar o primeiro produto da empresa.
                    </p>
                    <button
                        onClick={handleOpenCreate}
                        className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                        Adicionar produto
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {activeProducts.length > 0 && (
                        <div>
                            <h2 className="mb-3 text-sm font-medium text-gray-700">
                                Produtos Ativos
                            </h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {activeProducts.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        onEdit={() => handleOpenEdit(product)}
                                        onArchive={() => handleArchive(product)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {archivedProducts.length > 0 && (
                        <div>
                            <h2 className="mb-3 text-sm font-medium text-gray-700">
                                Produtos Arquivados
                            </h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {archivedProducts.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        onEdit={() => handleOpenEdit(product)}
                                        onArchive={() => handleArchive(product)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setEditingProduct(null)
                }}
                title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
                size="lg"
            >
                <ProductForm
                    product={editingProduct ?? undefined}
                    onSubmit={handleSubmit}
                    onCancel={() => {
                        setIsModalOpen(false)
                        setEditingProduct(null)
                    }}
                    isLoading={isSaving}
                />
            </Modal>

            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => {
                    setIsConfirmModalOpen(false)
                    setProductToArchive(null)
                }}
                onConfirm={handleConfirmArchive}
                title={
                    productToArchive?.isActive
                        ? 'Arquivar Produto'
                        : 'Ativar Produto'
                }
                message={
                    productToArchive?.isActive
                        ? `Ao arquivar "${productToArchive?.name}", os artigos e conteúdos existentes não serão afetados. Pode ativar o produto novamente a qualquer momento.`
                        : `Ao ativar "${productToArchive?.name}", o produto voltará a estar disponível para uso.`
                }
                confirmText={productToArchive?.isActive ? 'Arquivar' : 'Ativar'}
                variant={productToArchive?.isActive ? 'warning' : 'info'}
                isLoading={isSaving}
            />
        </div>
    )
}
