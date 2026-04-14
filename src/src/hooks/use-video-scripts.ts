import { articleService } from '@/services/article.service';
import {
    videoScriptService,
    type VideoScriptWithRelations,
    type VideoScriptsFilters,
    type UpdateVideoScriptInput,
} from '@/services/video-script.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { SocialChannel } from '@/types/database';
import { generateVideoScript } from '@/lib/ai';
import { useCallback, useEffect, useState } from 'react';

export interface GenerateScriptParams {
    articleId: string;
    targetChannel: SocialChannel;
    durationSec: number;
}

export function useVideoScripts(filters?: VideoScriptsFilters) {
    const { currentWorkspace } = useWorkspaceStore();
    const [scripts, setScripts] = useState<VideoScriptWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchScripts = useCallback(async () => {
        if (!currentWorkspace?.id) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await videoScriptService.getVideoScripts(
                currentWorkspace.id,
                filters
            );
            setScripts(data);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar roteiros'
            );
        } finally {
            setIsLoading(false);
        }
    }, [currentWorkspace?.id, filters]);

    useEffect(() => {
        fetchScripts();
    }, [fetchScripts]);

    const generateScript = useCallback(
        async (
            params: GenerateScriptParams
        ): Promise<{ success: boolean; error?: string }> => {
            if (!currentWorkspace?.id) {
                return { success: false, error: 'Workspace não carregado' };
            }

            setIsGenerating(true);
            setError(null);

            try {
                const article = await articleService.getArticle(params.articleId);
                if (!article) {
                    return { success: false, error: 'Artigo não encontrado' };
                }

                const result = await generateVideoScript({
                    article,
                    targetChannel: params.targetChannel,
                    durationSec: params.durationSec,
                    workspace: currentWorkspace,
                });

                if (!result.success) {
                    return {
                        success: false,
                        error: result.error || 'Erro ao gerar roteiro',
                    };
                }

                await videoScriptService.createVideoScript({
                    articleId: params.articleId,
                    workspaceId: currentWorkspace.id,
                    title: result.script.title,
                    hook: result.script.hook,
                    problem: result.script.problem,
                    solution: result.script.solution,
                    cta: result.script.cta,
                    fullScript: result.script.fullScript || '',
                    durationSec: result.script.durationSec,
                    targetChannel: params.targetChannel,
                    onScreenText: result.script.onScreenText,
                    bRoll: result.script.bRoll,
                    aiGenerated: true,
                });

                await fetchScripts();
                return { success: true };
            } catch (err) {
                return {
                    success: false,
                    error:
                        err instanceof Error
                            ? err.message
                            : 'Erro desconhecido',
                };
            } finally {
                setIsGenerating(false);
            }
        },
        [currentWorkspace, fetchScripts]
    );

    const updateScript = useCallback(
        async (
            id: string,
            input: UpdateVideoScriptInput
        ): Promise<boolean> => {
            try {
                await videoScriptService.updateVideoScript(id, input);
                await fetchScripts();
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao atualizar roteiro'
                );
                return false;
            }
        },
        [fetchScripts]
    );

    const approveScript = useCallback(
        async (id: string): Promise<boolean> => {
            try {
                await videoScriptService.updateStatus(id, 'APPROVED');
                await fetchScripts();
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao aprovar roteiro'
                );
                return false;
            }
        },
        [fetchScripts]
    );

    const deleteScript = useCallback(
        async (id: string): Promise<boolean> => {
            try {
                await videoScriptService.deleteVideoScript(id);
                setScripts((prev) => prev.filter((s) => s.id !== id));
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao eliminar roteiro'
                );
                return false;
            }
        },
        []
    );

    const approvedCount = scripts.filter((s) => s.status === 'APPROVED').length;
    const totalCount = scripts.length;

    return {
        scripts,
        isLoading,
        isGenerating,
        error,
        approvedCount,
        totalCount,
        generateScript,
        updateScript,
        approveScript,
        deleteScript,
        refetch: fetchScripts,
    };
}
