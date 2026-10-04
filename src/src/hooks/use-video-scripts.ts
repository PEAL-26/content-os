import {
    videoScriptService,
    type VideoScriptWithRelations,
    type VideoScriptsFilters,
    type UpdateVideoScriptInput,
} from '@/services/video-script.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useCallback, useEffect, useState } from 'react';

/**
 * A geração é assíncrona (Inngest): esta hook só lista/actualiza/apaga. O que
 * dispara a geração é o `generationJobService.enqueue` na página.
 *
 * Os filtros entram desestruturados em primitivos de propósito: o `filters`
 * objecto é recriado a cada render pela página e, se entrasse nas deps tal e
 * qual, cada `setScripts` relançava o fetch em loop infinito.
 */
export function useVideoScripts(filters?: VideoScriptsFilters) {
    const { currentWorkspace } = useWorkspaceStore();
    const [scripts, setScripts] = useState<VideoScriptWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const workspaceId = currentWorkspace?.id;
    const status = filters?.status;
    const targetChannel = filters?.targetChannel;
    const articleId = filters?.articleId;

    const fetchScripts = useCallback(async () => {
        if (!workspaceId) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await videoScriptService.getVideoScripts(workspaceId, {
                status,
                targetChannel,
                articleId,
            });
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
    }, [workspaceId, status, targetChannel, articleId]);

    useEffect(() => {
        fetchScripts();
    }, [fetchScripts]);

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
        error,
        approvedCount,
        totalCount,
        updateScript,
        approveScript,
        deleteScript,
        refetch: fetchScripts,
    };
}
