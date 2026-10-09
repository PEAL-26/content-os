import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArtifactActions } from './artifact-actions';
import { MediaPromptCard } from './media-prompt-card';
import { useMediaCapabilities } from '@/hooks/use-media-capabilities';
import { formatCostUsd } from '@/lib/media/pricing';
import { mediaPromptService } from '@/services/media-prompt.service';
import {
    MEDIA_MODALITIES,
    MEDIA_MODALITY_LABELS,
    type AssetTargetType,
    type ContentMediaPrompt,
    type MediaModality,
} from '@/types/database';

// =============================================================================
// Painel de prompts de MEDIA de um alvo (peça ou artigo).
//
// É o sítio onde o requisito de portabilidade se cumpre: o utilizador lê o
// prompt, edita-o se quiser, copia-o para qualquer ferramenta, e — se tiver um
// modelo activo para a modalidade — gera o ficheiro com um clique, vendo o custo
// antes de gastar.
//
// A granularidade (um prompt por slide / por cena / por ilustração) vem do job
// MEDIA_PROMPT, não deste componente.
// =============================================================================

export interface MediaPromptsPanelProps {
    workspaceId: string;
    targetType: AssetTargetType;
    targetId: string;
    /** Rótulos por itemKey: "Slide 3" → `slide-3`. */
    labelsByItemKey?: Record<string, string>;
}

export function MediaPromptsPanel({
    workspaceId,
    targetType,
    targetId,
    labelsByItemKey,
}: MediaPromptsPanelProps) {
    const { capabilities } = useMediaCapabilities(workspaceId);
    const [prompts, setPrompts] = useState<ContentMediaPrompt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<MediaModality | 'ALL'>('ALL');

    const load = useCallback(async () => {
        if (!workspaceId || !targetId) {
            // Sem workspace não há query a fazer. Sem isto o painel ficava
            // preso em "A carregar…" para sempre.
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const rows = await mediaPromptService.list({
                targetType,
                targetId,
                ...(filter === 'ALL' ? {} : { modality: filter }),
            });
            setPrompts(rows);
            setError(null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar os prompts de media.'
            );
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, targetType, targetId, filter]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleSaveEdit = async (
        prompt: ContentMediaPrompt,
        value: string
    ): Promise<void> => {
        await mediaPromptService.save({
            workspaceId,
            targetType,
            targetId,
            modality: prompt.modality as MediaModality,
            itemKey: prompt.itemKey,
            prompt: value,
            negativePrompt: prompt.negativePrompt,
            aspectRatio: prompt.aspectRatio,
        });
        await load();
    };

    /** Quantos prompts de cada modalidade, para o resumo de custo. */
    const countsByModality = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const prompt of prompts) {
            counts[prompt.modality] = (counts[prompt.modality] ?? 0) + 1;
        }
        return counts;
    }, [prompts]);

    if (isLoading) {
        return (
            <p className="py-2 text-xs text-gray-400">A carregar prompts…</p>
        );
    }

    if (error) {
        return (
            <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">
                {error}
            </p>
        );
    }

    if (prompts.length === 0) {
        return (
            <p className="rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-500">
                Sem prompts de media. Escolhe as modalidades ao gerar a peça
                para os prompts de imagem, áudio e vídeo serem criados
                automaticamente.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setFilter('ALL')}
                        className={`rounded px-2 py-0.5 text-[10px] ${
                            filter === 'ALL'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                        Todos
                    </button>
                    {MEDIA_MODALITIES.map((modality) => (
                        <button
                            key={modality}
                            type="button"
                            onClick={() => setFilter(modality)}
                            className={`rounded px-2 py-0.5 text-[10px] ${
                                filter === modality
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 text-gray-600'
                            }`}
                        >
                            {MEDIA_MODALITY_LABELS[modality]}
                        </button>
                    ))}
                </div>

                {/* O custo total da modalidade, calculado com a MESMA tabela
                    de preços que o servidor usa. */}
                {MEDIA_MODALITIES.map((modality) => {
                    const count = countsByModality[modality] ?? 0;
                    const capability = capabilities[modality];
                    if (count === 0 || capability.unitUsd === null) {
                        return null;
                    }
                    return (
                        <span
                            key={`cost-${modality}`}
                            className="text-[10px] text-gray-500"
                        >
                            {count}×{MEDIA_MODALITY_LABELS[modality]}:{' '}
                            <strong>
                                {formatCostUsd(capability.unitUsd * count)}
                            </strong>
                        </span>
                    );
                })}
            </div>

            {prompts.map((prompt) => {
                const modality = prompt.modality as MediaModality;
                const capability = capabilities[modality];
                const label =
                    labelsByItemKey?.[prompt.itemKey] ?? prompt.itemKey;
                return (
                    <div key={`${prompt.modality}-${prompt.itemKey}`}>
                        <MediaPromptCard
                            prompt={prompt}
                            modality={modality}
                            label={label}
                            isEdited={Boolean(prompt.editedAt)}
                            onSaveEdit={(value) =>
                                handleSaveEdit(prompt, value)
                            }
                        />
                        {/* O botão de gerar vive aqui e não no cartão: a
                            confirmação com o custo é uma decisão, não um
                            detalhe do cartão. */}
                        <div className="mt-1 flex justify-end">
                            <ArtifactActions
                                mediaPromptId={prompt.id}
                                modality={modality}
                                label={label}
                                disabledReason={capability.reason}
                                estimatedCostUsd={capability.unitUsd}
                                highCost={capability.highCost}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}