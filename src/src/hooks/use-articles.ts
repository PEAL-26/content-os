import { useAuthContext } from '@/context/use-auth-context';
import type {
    CreateArticleInput,
    UpdateArticleInput,
} from '@/lib/schemas/article';
import {
    articleService,
    type GetArticlesFilters,
} from '@/services/article.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { ArticleStatus, ArticleWithRelations } from '@/types/database';
import { useCallback, useEffect, useState } from 'react';

const DEFAULT_LIMIT = 20;

export interface ArticlesFilters {
    status: ArticleStatus | 'ALL';
    pillarId: string | null;
    productId: string | null;
    search: string;
}

export interface UseArticlesOptions {
    filters: ArticlesFilters;
    /** Teto de resultados por página (default 20). */
    limit?: number;
    /**
     * false = não pede artigos (mantém a última lista). Default true.
     * Usado por pickers que só precisam de artigos com o modal aberto.
     */
    enabled?: boolean;
}

export function useArticles(options: UseArticlesOptions) {
    const { currentWorkspace } = useWorkspaceStore();
    const { user } = useAuthContext();
    const [articles, setArticles] = useState<ArticleWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);

    const workspaceId = currentWorkspace?.id;
    // Primitivos: o objecto `filters` é recriado a cada render pelo caller e,
    // se fosse para as deps tal e qual, cada fetch relançava o seguinte em loop.
    const status = options.filters.status;
    const pillarId = options.filters.pillarId;
    const productId = options.filters.productId;
    const search = options.filters.search;
    const limit = options.limit ?? DEFAULT_LIMIT;
    const enabled = options.enabled ?? true;

    const fetchArticles = useCallback(
        async (loadMore = false) => {
            if (!workspaceId || !enabled) return;

            if (loadMore) {
                setIsLoadingMore(true);
            } else {
                setIsLoading(true);
            }
            setError(null);

            try {
                const currentOffset = loadMore ? offset : 0;

                const queryFilters: GetArticlesFilters = {
                    status: status === 'ALL' ? undefined : status,
                    pillarId,
                    productId,
                    search: search || undefined,
                    limit,
                    offset: currentOffset,
                };

                const data = await articleService.getArticles(
                    workspaceId,
                    queryFilters
                );

                if (loadMore) {
                    setArticles((prev) => [...prev, ...data]);
                    setOffset((prev) => prev + data.length);
                } else {
                    setArticles(data);
                    setOffset(data.length);
                }

                setHasMore(data.length === limit);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao carregar artigos'
                );
            } finally {
                setIsLoading(false);
                setIsLoadingMore(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- offset intentionally omitted to prevent infinite loops
        [workspaceId, enabled, status, pillarId, productId, search, limit]
    );

    // Um único effect: workspace, filtros, limite e enabled mudam juntos o fetch.
    // Filtrar recomeça a lista na página 1, por isso o offset também resets.
    useEffect(() => {
        if (!enabled) return;
        if (!workspaceId) {
            setArticles([]);
            return;
        }
        setOffset(0);
        fetchArticles(false);
    }, [fetchArticles, enabled, workspaceId]);

    const loadMore = useCallback(async () => {
        if (!hasMore || isLoadingMore) return;
        await fetchArticles(true);
    }, [hasMore, isLoadingMore, fetchArticles]);

    const createArticle = useCallback(
        async (input: CreateArticleInput) => {
            if (!workspaceId) {
                return { success: false, error: 'Sem workspace selecionado' };
            }

            try {
                const article = await articleService.createArticle(
                    workspaceId,
                    input,
                    user?.id
                );
                const articleWithRelations: ArticleWithRelations = {
                    ...article,
                    product: null,
                    pillar: null,
                    _count: { contentPieces: 0 },
                };
                setArticles((prev) => [articleWithRelations, ...prev]);
                return { success: true, article, articleId: article.id };
            } catch (err) {
                return {
                    success: false,
                    error:
                        err instanceof Error
                            ? err.message
                            : 'Erro ao criar artigo',
                };
            }
        },
        [workspaceId, user?.id]
    );

    const updateArticle = useCallback(
        async (id: string, input: UpdateArticleInput) => {
            try {
                const updated = await articleService.updateArticle(id, input);
                setArticles((prev) =>
                    prev.map((a) => (a.id === id ? { ...a, ...updated } : a))
                );
                return { success: true, article: updated };
            } catch (err) {
                return {
                    success: false,
                    error:
                        err instanceof Error
                            ? err.message
                            : 'Erro ao atualizar artigo',
                };
            }
        },
        []
    );

    const deleteArticle = useCallback(async (id: string) => {
        try {
            await articleService.deleteArticle(id);
            setArticles((prev) => prev.filter((a) => a.id !== id));
            return { success: true };
        } catch (err) {
            return {
                success: false,
                error:
                    err instanceof Error
                        ? err.message
                        : 'Erro ao eliminar artigo',
            };
        }
    }, []);

    const duplicateArticle = useCallback(
        async (id: string) => {
            try {
                const duplicated = await articleService.duplicateArticle(id);
                const articleWithRelations: ArticleWithRelations = {
                    ...duplicated,
                    product: articles.find((a) => a.id === id)?.product || null,
                    pillar: articles.find((a) => a.id === id)?.pillar || null,
                    _count: { contentPieces: 0 },
                };
                setArticles((prev) => [articleWithRelations, ...prev]);
                return { success: true, article: duplicated };
            } catch (err) {
                return {
                    success: false,
                    error:
                        err instanceof Error
                            ? err.message
                            : 'Erro ao duplicar artigo',
                };
            }
        },
        [articles]
    );

    return {
        articles,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        createArticle,
        updateArticle,
        deleteArticle,
        duplicateArticle,
        refetch: () => fetchArticles(false),
    };
}
