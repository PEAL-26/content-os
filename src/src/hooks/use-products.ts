import { useState, useEffect, useCallback, useRef } from 'react'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { productService } from '@/services/product.service'
import type { Product } from '@/types/database'
import type { CreateProductInput, UpdateProductInput } from '@/lib/schemas/product'

export type ProductSortBy = 'createdAt' | 'name' | 'isActive'
export type SortOrder = 'asc' | 'desc'

export function useProducts() {
    const { currentWorkspace } = useWorkspaceStore()
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [sortBy, setSortBy] = useState<ProductSortBy>('createdAt')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const hasFetchedRef = useRef(false)

    const workspaceId = currentWorkspace?.id

    const fetchProducts = useCallback(async () => {
        if (!workspaceId) return

        setIsLoading(true)
        setError(null)

        try {
            const data = await productService.getProducts(workspaceId)
            setProducts(data)
            hasFetchedRef.current = true
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar produtos')
        } finally {
            setIsLoading(false)
        }
    }, [workspaceId])

    useEffect(() => {
        if (workspaceId && !hasFetchedRef.current) {
            fetchProducts()
        }

        return () => {
            if (!workspaceId) {
                hasFetchedRef.current = false
                setProducts([])
            }
        }
    }, [workspaceId, fetchProducts])

    const createProduct = useCallback(
        async (input: CreateProductInput) => {
            if (!workspaceId) {
                return { success: false, error: 'Sem workspace selecionado' }
            }

            try {
                const product = await productService.createProduct(
                    workspaceId,
                    input
                )
                setProducts((prev) => [product, ...prev])
                return { success: true, product }
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : 'Erro ao criar produto',
                }
            }
        },
        [workspaceId]
    )

    const updateProduct = useCallback(
        async (id: string, input: UpdateProductInput) => {
            try {
                const product = await productService.updateProduct(id, input)
                setProducts((prev) =>
                    prev.map((p) => (p.id === id ? product : p))
                )
                return { success: true, product }
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : 'Erro ao atualizar produto',
                }
            }
        },
        []
    )

    const toggleActive = useCallback(async (id: string) => {
        try {
            const product = await productService.toggleActive(id)
            setProducts((prev) =>
                prev.map((p) => (p.id === id ? product : p))
            )
            return { success: true, product }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Erro ao arquivar produto',
            }
        }
    }, [])

    const sortedProducts = [...products].sort((a, b) => {
        let comparison = 0

        switch (sortBy) {
            case 'createdAt':
                comparison =
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime()
                break
            case 'name':
                comparison = a.name.localeCompare(b.name)
                break
            case 'isActive':
                comparison = (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1)
                break
        }

        return sortOrder === 'asc' ? comparison : -comparison
    })

    const activeProducts = sortedProducts.filter((p) => p.isActive)
    const archivedProducts = sortedProducts.filter((p) => !p.isActive)

    return {
        products: sortedProducts,
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
        refetch: fetchProducts,
    }
}
