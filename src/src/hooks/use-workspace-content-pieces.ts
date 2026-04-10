import { articleService } from '@/services/article.service';
import { contentPieceService } from '@/services/content-piece.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type {
    ContentFormat,
    ContentPieceStatus,
    ContentPieceWithRelations,
    ContentSlide,
} from '@/types/database';
import { generateContentPieces, type GeneratedPiece } from '@/lib/ai';
import { useCallback, useEffect, useState } from 'react';

export interface WorkspaceContentFilters {
    format?: ContentFormat | null;
    channelId?: string | null;
    status?: ContentPieceStatus | null;
    articleId?: string | null;
}

export interface UpdatePieceParams {
    title?: string | null;
    body?: string;
    hookText?: string | null;
    ctaText?: string | null;
    hashtags?: string[];
    slides?: ContentSlide[] | null;
    slideCount?: number | null;
    channelId?: string | null;
}

export function useWorkspaceContentPieces(filters?: WorkspaceContentFilters) {
    const { currentWorkspace } = useWorkspaceStore();
    const [pieces, setPieces] = useState<ContentPieceWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPieces = useCallback(async () => {
        if (!currentWorkspace?.id) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await contentPieceService.getWorkspaceContentPieces(
                currentWorkspace.id,
                {
                    format: filters?.format || undefined,
                    channelId: filters?.channelId || undefined,
                    status: filters?.status || undefined,
                    articleId: filters?.articleId || undefined,
                }
            );
            setPieces(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Erro ao carregar peças'
            );
        } finally {
            setIsLoading(false);
        }
    }, [
        currentWorkspace?.id,
        filters?.format,
        filters?.channelId,
        filters?.status,
        filters?.articleId,
    ]);

    useEffect(() => {
        fetchPieces();
    }, [fetchPieces]);

    const updatePiece = useCallback(
        async (id: string, params: UpdatePieceParams): Promise<boolean> => {
            try {
                await contentPieceService.updateContentPiece(id, params);
                await fetchPieces();
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao atualizar peça'
                );
                return false;
            }
        },
        [fetchPieces]
    );

    const approvePiece = useCallback(
        async (id: string): Promise<boolean> => {
            try {
                await contentPieceService.updateStatus(id, 'APPROVED');
                await fetchPieces();
                return true;
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : 'Erro ao aprovar peça'
                );
                return false;
            }
        },
        [fetchPieces]
    );

    const deletePiece = useCallback(async (id: string): Promise<boolean> => {
        try {
            await contentPieceService.deleteContentPiece(id);
            setPieces((prev) => prev.filter((p) => p.id !== id));
            return true;
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Erro ao eliminar peça'
            );
            return false;
        }
    }, []);

    const approvedCount = pieces.filter((p) => p.status === 'APPROVED').length;
    const totalCount = pieces.length;

    const regeneratePiece = useCallback(
        async (piece: ContentPieceWithRelations): Promise<{ success: boolean; error?: string }> => {
            if (!currentWorkspace?.id || !piece.articleId) {
                return { success: false, error: 'Workspace ou artigo não encontrado' };
            }

            try {
                const article = await articleService.getArticle(piece.articleId);
                if (!article) {
                    return { success: false, error: 'Artigo não encontrado' };
                }

                const result = await generateContentPieces({
                    article,
                    formats: [piece.format],
                    workspace: currentWorkspace,
                });

                if (!result.success || result.pieces.length === 0) {
                    return {
                        success: false,
                        error: result.errors[0]?.error || 'Erro ao gerar conteúdo',
                    };
                }

                const generatedPiece = result.pieces[0] as GeneratedPiece;

                await contentPieceService.createContentPiece({
                    articleId: piece.articleId,
                    workspaceId: currentWorkspace.id,
                    format: piece.format,
                    channelId: piece.channelId,
                    pillar: piece.pillar || null,
                    title: generatedPiece.title,
                    body: generatedPiece.body,
                    hookText: generatedPiece.hookText,
                    ctaText: generatedPiece.ctaText,
                    hashtags: generatedPiece.hashtags,
                    slides: generatedPiece.slides,
                    slideCount: generatedPiece.slideCount,
                    aiGenerated: true,
                });

                await fetchPieces();
                return { success: true };
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : 'Erro desconhecido',
                };
            }
        },
        [currentWorkspace, fetchPieces]
    );

    return {
        pieces,
        isLoading,
        error,
        approvedCount,
        totalCount,
        updatePiece,
        approvePiece,
        deletePiece,
        regeneratePiece,
        refetch: fetchPieces,
    };
}
