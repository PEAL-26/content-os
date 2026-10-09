import { Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { generationJobService } from '@/services/generation-job.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import {
    MEDIA_MODALITY_LABELS,
    type MediaModality,
} from '@/types/database';

// =============================================================================
// Acções de gerar ARTEFACTOS.
//
// Separação deliberada (Decisão 27):
//   · os PROMPTS de media são gerados automaticamente (baratos, são texto);
//   · os FICHEIROS só saem daqui, e SEMPRE com o custo estimado à vista.
//
// Um vídeo de 30 s do Veo 3 custa ~$22,50. Um carrossel de 6 slides ~$0,24 em
// imagens. Disparar isso sem mostrar o valor seria a decisão mais cara que a app
// poderia tomar sozinha.
// =============================================================================

export interface ArtifactActionsProps {
    /** content_media_prompts.id do prompt a gerar. */
    mediaPromptId: string;
    modality: MediaModality;
    /** Descrição do que vai ser gerado ("Slide 3", "Cena 2"). */
    label: string;
    /** Motivo pelo qual não se pode gerar (sem modelo activo, por exemplo). */
    disabledReason?: string | null;
    /** Custo estimado por ficheiro, já formatado. `null` = preço desconhecido. */
    estimatedCostUsd?: number | null;
    /** Avisa o utilizador quando o custo é alto (vídeo, por exemplo). */
    highCost?: boolean;
    onGenerated?: () => void;
}

export function ArtifactActions({
    mediaPromptId,
    modality,
    label,
    disabledReason = null,
    estimatedCostUsd = null,
    highCost = false,
    onGenerated,
}: ArtifactActionsProps) {
    const { currentWorkspace } = useWorkspaceStore();
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!currentWorkspace || isBusy) return;

        // O preço aparece ANTES da confirmação, e o próprio botão carrega-o —
        // não há caminho que gaste dinheiro sem o valor ter sido visto.
        const custo = estimatedCostUsd === null ? 'custo desconhecido' : `$${estimatedCostUsd.toFixed(2)}`;
        const confirmado = window.confirm(
            highCost
                ? `Gerar ${MEDIA_MODALITY_LABELS[modality].toLowerCase()} para "${label}"?\n\n` +
                      `Custo estimado: ${custo}. Os vídeos podem demorar vários minutos a gerar.`
                : `Gerar ${MEDIA_MODALITY_LABELS[modality].toLowerCase()} para "${label}"?\n\n` +
                      `Custo estimado: ${custo}.`
        );
        if (!confirmado) return;

        setIsBusy(true);
        setError(null);
        try {
            await generationJobService.enqueue({
                workspaceId: currentWorkspace.id,
                jobType: 'MEDIA_ARTIFACT',
                params: {
                    mediaPromptId,
                    // O `enqueue` cria a linha em `content_assets` em PENDING
                    // dentro da transacção — o cliente não a cria, e é isso
                    // que impede dois cliques de pagarem duas vezes.
                    assetId: '',
                },
            });
            onGenerated?.();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Não foi possível enfileirar a geração.'
            );
        } finally {
            setIsBusy(false);
        }
    };

    const canGenerate = !disabledReason && currentWorkspace;

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate || isBusy}
                title={disabledReason ?? 'Gerar ficheiro'}
                className="inline-flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
                {isBusy ? (
                    <span className="block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                    <Sparkles className="h-3 w-3" />
                )}
                Gerar {MEDIA_MODALITY_LABELS[modality].toLowerCase()}
            </button>

            {error && (
                <p className="max-w-48 text-right text-[10px] text-red-600">
                    {error}
                </p>
            )}

            {disabledReason && (
                <p className="flex max-w-48 items-start gap-1 text-right text-[10px] text-amber-700">
                    <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
                    {disabledReason}
                </p>
            )}
        </div>
    );
}