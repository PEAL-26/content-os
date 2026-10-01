import {
    getGenerationPrompts,
    updateGenerationPrompt,
    type PortablePromptItem,
} from '@/services/ai-prompt.service';
import { generationJobService } from '@/services/generation-job.service';
import { useGenerationJobStore } from '@/stores/generation-jobs-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { parseItemKeyOrder } from '@/lib/ai/generation-job-types';
import { supabase } from '@/lib/supabase';
import { useGenerationJob } from './use-generation-job';
import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// Prompts de uma peça: leitura, edição (save explícito) e acções que geram a
// peça (ou um item) a partir do prompt.
//
// Os prompts vivem em `content_generation_prompts` (itemKey 'main' = prompt da
// peça; 'slide-N' / 'tweet-N' = prompts por item). A geração corre como job
// assíncrono (CONTENT_PIECES / CONTENT_ITEM) e o estado chega via Realtime.
// =============================================================================

export interface UsePiecePromptsResult {
    prompts: PortablePromptItem[];
    isLoading: boolean;
    /** Editor controlado: o caller guarda o texto e chama `savePrompt`. */
    savePrompt: (itemKey: string, prompt: string) => Promise<boolean>;
    /** Gera a peça a partir do prompt 'main' da própria peça. */
    generatePiece: (piece: {
        id: string;
        format: string;
        body: string;
    }) => Promise<void>;
    /** Regenera um item (slide-N / tweet-N) a partir do prompt desse item. */
    generateItem: (pieceId: string, itemKey: string) => Promise<void>;
    /** True enquanto há um pedido em curso ou um job de prompt/item activo. */
    isBusy: boolean;
    /** true se o prompt desse item foi editado à mão (pede confirmação). */
    isItemEdited: (itemKey: string) => boolean;
    /** Relê os prompts (usado depois de uma acção externa). */
    refresh: () => Promise<void>;
    error: string | null;
    notice: string | null;
}

export function usePiecePrompts(
    targetType: 'PIECE' | 'VIDEO_SCRIPT',
    targetId: string
): UsePiecePromptsResult {
    const { currentWorkspace } = useWorkspaceStore();
    const rememberJob = useGenerationJobStore((s) => s.rememberJob);

    const [prompts, setPrompts] = useState<PortablePromptItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [articleId, setArticleId] = useState<string | null>(null);
    /**
     * Confirmação de que um job foi enfileirado. A geração é assíncrona (Inngest),
     * por isso o conteúdo/prompt novo só aparece quando o job termina — este
     * texto diz o que esperar em vez de deixar o botão em silêncio.
     */
    const [notice, setNotice] = useState<string | null>(null);

    const fetchPrompts = useCallback(async () => {
        if (!targetId) return;
        setIsLoading(true);
        try {
            const rows = await getGenerationPrompts(targetType, targetId);
            setPrompts(
                rows.map((r) => ({
                    itemKey: r.itemKey ?? 'main',
                    prompt: r.prompt,
                    editedAt: r.editedAt ?? null,
                }))
            );
            setError(null);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Erro ao carregar prompts.'
            );
        } finally {
            setIsLoading(false);
        }
    }, [targetType, targetId]);

    useEffect(() => {
        void fetchPrompts();
    }, [fetchPrompts]);

    // O job CONTENT_PROMPT é escrito por articleId, não por peça: resolvemo-lo
    // para poder seguir a escrita do prompt em tempo real.
    useEffect(() => {
        if (targetType !== 'PIECE' || !targetId) {
            setArticleId(null);
            return;
        }
        let disposed = false;
        void resolveArticleId(targetId)
            .then((id) => {
                if (!disposed) setArticleId(id);
            })
            .catch(() => {
                if (!disposed) setArticleId(null);
            });
        return () => {
            disposed = true;
        };
    }, [targetType, targetId]);

    const promptJob = useGenerationJob(
        targetType === 'PIECE' && articleId
            ? { kind: 'target', jobType: 'CONTENT_PROMPT', targetId: articleId }
            : null
    );
    const itemJob = useGenerationJob(
        targetType === 'PIECE' && targetId
            ? { kind: 'target', jobType: 'CONTENT_ITEM', targetId }
            : null
    );

    const isJobActive = promptJob.isActive || itemJob.isActive;

    // A escrita/reconstrução acontece no servidor: quando o job deixa de estar
    // activo, relemos os prompts — o utilizador não tem de recarregar a página
    // para ver o resultado.
    const wasActiveRef = useRef(false);
    useEffect(() => {
        if (wasActiveRef.current && !isJobActive) {
            void fetchPrompts();
        }
        wasActiveRef.current = isJobActive;
    }, [isJobActive, fetchPrompts]);

    const savePrompt = useCallback(
        async (itemKey: string, prompt: string): Promise<boolean> => {
            try {
                const ok = await updateGenerationPrompt(
                    targetType,
                    targetId,
                    itemKey,
                    prompt
                );
                if (!ok) {
                    setError('Este prompt já não existe. Actualiza a peça.');
                    return false;
                }
                await fetchPrompts();
                setError(null);
                return true;
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao guardar prompt.'
                );
                return false;
            }
        },
        [targetType, targetId, fetchPrompts]
    );

    // Evita double-submit quando dois cliques chegam quase em simultâneo.
    const inFlight = useRef(false);

    const generatePiece = useCallback(
        async (piece: { id: string; format: string; body: string }) => {
            if (!currentWorkspace || inFlight.current) return;
            inFlight.current = true;
            setIsGenerating(true);
            setError(null);
            setNotice(null);
            try {
                const id = articleId ?? (await resolveArticleId(piece.id));
                // Peça vazia → preenche por cima; com conteúdo → nova versão
                // (a original fica intacta e o conteúdo vai para a nova).
                const isNewVersion = Boolean(piece.body.trim());

                const result = await generationJobService.enqueue({
                    workspaceId: currentWorkspace.id,
                    jobType: 'CONTENT_PIECES',
                    params: {
                        articleId: id,
                        formats: [piece.format],
                        useStoredPrompt: true,
                    },
                    targets: [
                        {
                            format: piece.format,
                            targetId: piece.id,
                            mode: isNewVersion ? 'NEW_VERSION' : 'FILL',
                        },
                    ],
                });
                rememberJob({
                    jobType: 'CONTENT_PIECES',
                    targetId: id,
                    jobId: result.jobId,
                });

                setNotice(
                    isNewVersion
                        ? 'A gerar uma nova versão da peça a partir deste prompt. A peça actual fica intacta — a nova aparece na lista do artigo.'
                        : 'A gerar a peça a partir deste prompt em segundo plano.'
                );
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao gerar a peça a partir do prompt.'
                );
            } finally {
                inFlight.current = false;
                setIsGenerating(false);
            }
        },
        [currentWorkspace, rememberJob, articleId]
    );

    const generateItem = useCallback(
        async (pieceId: string, itemKey: string) => {
            if (!currentWorkspace || inFlight.current) return;
            inFlight.current = true;
            setIsGenerating(true);
            setError(null);
            try {
                const result = await generationJobService.enqueue({
                    workspaceId: currentWorkspace.id,
                    jobType: 'CONTENT_ITEM',
                    params: { pieceId, itemKey },
                });
                rememberJob({
                    jobType: 'CONTENT_ITEM',
                    targetId: pieceId,
                    jobId: result.jobId,
                });
                setNotice('A regenerar o item em segundo plano.');
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : 'Erro ao gerar o item.'
                );
            } finally {
                inFlight.current = false;
                setIsGenerating(false);
            }
        },
        [currentWorkspace, rememberJob]
    );

    const isItemEdited = useCallback(
        (itemKey: string) =>
            Boolean(prompts.find((p) => p.itemKey === itemKey)?.editedAt ?? null),
        [prompts]
    );

    return {
        prompts,
        isLoading,
        savePrompt,
        generatePiece,
        generateItem,
        isBusy: isGenerating || isJobActive,
        isItemEdited,
        refresh: fetchPrompts,
        error,
        notice,
    };
}

/** Artigo dono da peça (o job CONTENT_PIECES trabalha por articleId). */
async function resolveArticleId(pieceId: string): Promise<string> {
    const { data, error } = await supabase
        .from('content_pieces')
        .select('articleId')
        .eq('id', pieceId)
        .single();
    if (error || !data) {
        throw new Error('Não foi possível identificar o artigo da peça.');
    }
    return (data as { articleId: string }).articleId;
}

/** Label legível de um itemKey ('main' → "Prompt da peça", 'slide-2' → "Slide 2"). */
export function promptItemLabel(
    itemKey: string,
    slideCount?: number | null
): string {
    if (itemKey === 'main') return 'Prompt da peça';

    const order = parseItemKeyOrder(itemKey);
    if (order === null) return itemKey;

    if (itemKey.startsWith('slide-')) {
        return `Slide ${order}${slideCount ? ` de ${slideCount}` : ''}`;
    }
    return `Tweet ${order}`;
}
