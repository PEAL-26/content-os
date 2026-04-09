import { generateContentPieces, type GeneratedPiece } from '@/lib/ai';
import { contentPieceService } from '@/services/content-piece.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type {
    Article,
    ContentFormat,
    ContentPieceWithRelations,
    ContentSlide,
    Product,
} from '@/types/database';
import type { PillarConfig } from '@/types/pillar';
import { useCallback, useEffect, useState } from 'react';

export interface GeneratePiecesParams {
    article: Article;
    formats: ContentFormat[];
    channelIds: Partial<Record<ContentFormat, string>>;
    product?: Product;
    pillar?: PillarConfig;
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

export function useContentPieces(articleId: string) {
    const { currentWorkspace } = useWorkspaceStore();
    const [pieces, setPieces] = useState<ContentPieceWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatingFormats, setGeneratingFormats] = useState<
        Set<ContentFormat>
    >(new Set());

    const fetchPieces = useCallback(async () => {
        if (!articleId) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await contentPieceService.getContentPieces(articleId);
            setPieces(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Erro ao carregar peças'
            );
        } finally {
            setIsLoading(false);
        }
    }, [articleId]);

    useEffect(() => {
        fetchPieces();
    }, [fetchPieces]);

    const generatePieces = useCallback(
        async (
            params: GeneratePiecesParams
        ): Promise<{
            success: boolean;
            created: number;
            errors: Array<{ format: ContentFormat; error: string }>;
        }> => {
            if (!currentWorkspace) {
                return {
                    success: false,
                    created: 0,
                    errors: [
                        {
                            format: 'CAROUSEL' as ContentFormat,
                            error: 'Workspace não carregado',
                        },
                    ],
                };
            }

            setIsGenerating(true);
            setGeneratingFormats(new Set(params.formats));

            try {
                const result = await generateContentPieces({
                    article: params.article,
                    formats: params.formats,
                    workspace: currentWorkspace,
                    product: params.product,
                    pillar: params.pillar,
                });

                if (!result.success && result.pieces.length === 0) {
                    return {
                        success: false,
                        created: 0,
                        errors: result.errors,
                    };
                }

                const piecesToCreate = result.pieces.map(
                    (piece: GeneratedPiece) => {
                        return {
                            articleId: params.article.id,
                            workspaceId: currentWorkspace.id,
                            format: piece.format,
                            productId: params.product?.id,
                            channelId: params.channelIds[piece.format] || null,
                            pillar: params.pillar?.pillar,
                            title: piece.title,
                            body: piece.body,
                            hookText: piece.hookText,
                            ctaText: piece.ctaText,
                            hashtags: piece.hashtags,
                            slides: piece.slides,
                            slideCount: piece.slideCount,
                            aiGenerated: true,
                        };
                    }
                );

                const created =
                    await contentPieceService.bulkCreate(piecesToCreate);

                await fetchPieces();

                return {
                    success: created.length > 0,
                    created: created.length,
                    errors: result.errors,
                };
            } catch (err) {
                return {
                    success: false,
                    created: 0,
                    errors: [
                        {
                            format: 'CAROUSEL' as ContentFormat,
                            error:
                                err instanceof Error
                                    ? err.message
                                    : 'Erro desconhecido',
                        },
                    ],
                };
            } finally {
                setIsGenerating(false);
                setGeneratingFormats(new Set());
            }
        },
        [currentWorkspace, fetchPieces]
    );

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

    const getPiece = useCallback(
        (id: string): ContentPieceWithRelations | undefined => {
            return pieces.find((p) => p.id === id);
        },
        [pieces]
    );

    return {
        pieces,
        isLoading,
        isGenerating,
        error,
        generatingFormats,
        generatePieces,
        updatePiece,
        approvePiece,
        deletePiece,
        getPiece,
        refetch: fetchPieces,
    };
}
