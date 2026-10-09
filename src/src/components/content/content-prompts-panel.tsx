import { PromptEditor } from '@/components/content/prompt-editor';
import { promptItemLabel, usePiecePrompts } from '@/hooks/use-piece-prompts';
import { parseItemKeyOrder } from '@/lib/ai/generation-job-types';
import { useEffect, useRef } from 'react';

/**
 * Editor de prompts de uma peça/roteiro, com as acções de geração associadas.
 *
 * Antes vivia num painel que misturava prompts, artefactos e publicações. Como
 * os artefactos passaram a ter tabela própria e as páginas de detalhe precisam
 * deste bloco isolado, ficou separado.
 */

interface ContentPromptsPanelProps {
    targetType: 'PIECE';
    targetId: string;
    /** Peça em foco — habilita "Gerar peça" / "Gerar este slide". */
    piece?: {
        id: string;
        format: string;
        body: string;
        slideCount?: number | null;
        /** O canal decide as regras que o prompt guardado tem de respeitar. */
        channelId: string | null;
    };
    /** Reescreve o prompt da peça com IA. */
    onRewritePrompt?: () => void;
    isRewritingPrompt?: boolean;
    /**
     * Força a releitura dos prompts, como no `ArtefactsPanel`: o painel não
     * segue todos os jobs (um `MEDIA_PROMPT` não tem prompt de conteúdo), por
     * isso quem chamou passa aqui o momento em que o prompt mudou.
     */
    reloadKey?: number;
}

export function ContentPromptsPanel({
    targetType,
    targetId,
    piece,
    onRewritePrompt,
    isRewritingPrompt = false,
    reloadKey = 0,
}: ContentPromptsPanelProps) {
    const {
        prompts,
        isLoading,
        savePrompt,
        generatePiece,
        generateItem,
        isBusy,
        isItemEdited,
        error,
        notice,
        refresh,
    } = usePiecePrompts(targetType, targetId);

    /**
     * Relê os prompts quando a página incrementa `reloadKey` — o mesmo
     * esquema do `ArtefactsPanel`. O primeiro render é de propósito ignorado:
     * a leitura inicial já é feita pelo `usePiecePrompts`, e repetir aqui
     * duplicava o pedido. Como o hook já segue o CONTENT_PROMPT das peças,
     * este empurrão cobre sobretudo alterações feitas noutro sítio.
     */
    const loadedKeyRef = useRef(reloadKey);
    useEffect(() => {
        if (loadedKeyRef.current === reloadKey) return;
        loadedKeyRef.current = reloadKey;
        void refresh();
    }, [refresh, reloadKey]);

    function confirmEditedItem(itemKey: string): boolean {
        if (itemKey === 'main') {
            return window.confirm(
                'O prompt desta peça foi editado por ti. Ao reescrevê-lo, esse texto é substituído pelo prompt que a IA vai escrever.\n\nContinuar?'
            );
        }
        return window.confirm(
            `O prompt de "${promptItemLabel(itemKey, piece?.slideCount)}" foi editado por ti. Ao regenerar o item, esse texto é substituído pelo prompt reconstruído a partir do novo conteúdo.\n\nContinuar?`
        );
    }

    /**
     * Acção de geração associada a um prompt: o 'main' gera a peça, um
     * 'slide-N'/'scene-N' regenera só esse item (carrossel e vídeo).
     */
    function generateActionFor(itemKey: string): {
        onGenerate?: () => void;
        generateLabel?: string;
    } {
        if (!piece) return {};

        if (itemKey === 'main') {
            return {
                onGenerate: () => {
                    void generatePiece(piece);
                },
                generateLabel: piece.body.trim()
                    ? 'Gerar nova versão com este prompt'
                    : 'Gerar peça com este prompt',
            };
        }

        const order = parseItemKeyOrder(itemKey);
        if (
            order === null ||
            (piece.format !== 'CAROUSEL' &&
                piece.format !== 'SHORT_VIDEO' &&
                piece.format !== 'VIDEO')
        ) {
            return {};
        }

        return {
            onGenerate: () => {
                // Ao regenerar um item, o job reconstrói o prompt a partir do
                // novo conteúdo — o texto escrito à mão seria deitado fora.
                if (isItemEdited(itemKey) && !confirmEditedItem(itemKey)) {
                    return;
                }
                void generateItem(piece.id, itemKey);
            },
            generateLabel:
                piece.format === 'CAROUSEL'
                    ? 'Gerar este slide'
                    : 'Gerar este tweet',
        };
    }

    function handleRewrite(): void {
        if (isItemEdited('main') && !confirmEditedItem('main')) return;
        onRewritePrompt?.();
    }

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900">
                    Prompt
                </h4>
                {onRewritePrompt && (
                    <button
                        type="button"
                        onClick={handleRewrite}
                        disabled={isRewritingPrompt}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        {isRewritingPrompt
                            ? 'A escrever…'
                            : 'Reescrever prompt'}
                    </button>
                )}
            </div>

            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            {notice && (
                <p className="mb-2 text-xs text-blue-600">{notice}</p>
            )}

            {isLoading ? (
                <p className="text-xs text-gray-500">A carregar prompts…</p>
            ) : prompts.length === 0 ? (
                <p className="text-xs text-gray-500">
                    {onRewritePrompt
                        ? 'Ainda não há prompt guardado. Podes escrever um com "Reescrever prompt" — a peça fica à espera do prompt, sem conteúdo.'
                        : 'Ainda não há prompt guardado. A peça é criada com o prompt que a IA escreve a partir do artigo.'}
                </p>
            ) : (
                <div className="space-y-3">
                    {prompts.map((p) => (
                        <PromptEditor
                            key={p.itemKey}
                            itemKey={p.itemKey}
                            label={promptItemLabel(p.itemKey, piece?.slideCount)}
                            prompt={p.prompt}
                            editedAt={p.editedAt ?? null}
                            onSave={savePrompt}
                            isGenerating={isBusy || isRewritingPrompt}
                            {...generateActionFor(p.itemKey)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}