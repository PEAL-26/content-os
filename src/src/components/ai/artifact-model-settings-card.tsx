import { useState } from 'react';
import { ArtifactModelSettings } from './artifact-model-settings';
import { useMediaCapabilities } from '@/hooks/use-media-capabilities';
import type { ArtifactModelMapping } from '@/lib/media/resolution';
import {
    MEDIA_MODALITIES,
    MEDIA_MODALITY_LABELS,
} from '@/types/database';

// =============================================================================
// Card de ARTEFACTOS: escolhe o modelo por modalidade e mostra o que fica
// resolvido.
//
// É o complemento do editor de modalidades: lá marca-se *que* um modelo produz
// imagem; aqui escolhe-se *qual* quando há mais do que um. Sem mapeamento
// explícito o dispatcher usa o primeiro activo por `priority` — o que aparece
// escrito abaixo de cada select, para nunca haver dúvida sobre o que vai
// acontecer.
// =============================================================================

export interface ArtifactModelSettingsCardProps {
    workspaceId: string;
    readOnly?: boolean;
}

export function ArtifactModelSettingsCard({
    workspaceId,
    readOnly = false,
}: ArtifactModelSettingsCardProps) {
    const { capabilities, optionsByModality, mapping, setMapping } =
        useMediaCapabilities(workspaceId);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = async (next: ArtifactModelMapping | null) => {
        setIsSaving(true);
        setError(null);
        try {
            await setMapping(next);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao guardar o mapeamento.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    const totalOptions = MEDIA_MODALITIES.reduce(
        (sum, modality) => sum + optionsByModality[modality].length,
        0
    );

    if (totalOptions === 0) {
        return (
            <div className="space-y-2">
                <p className="text-sm text-gray-600">
                    Nenhum modelo declara gerar imagem, áudio ou vídeo.
                </p>
                <p className="text-xs text-gray-500">
                    Nos providers, marca as modalidades de cada modelo
                    ({"que dados este modelo produz?"}). Enquanto nenhum
                    marcar, os prompts de media continuam a ser gerados e
                    editáveis — só o ficheiro não sai dali.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <ArtifactModelSettings
                value={mapping}
                optionsByModality={optionsByModality}
                onChange={(next) => void handleChange(next)}
                disabled={readOnly || isSaving}
            />

            {/* O que vai acontecer SEM edição: a cadeia de resolução, escrita.
                Um utilizador que não toque em nada tem de saber qual modelo
                entra. */}
            <dl className="space-y-1 rounded bg-gray-50 p-3 text-xs">
                {MEDIA_MODALITIES.map((modality) => {
                    const capability = capabilities[modality];
                    return (
                        <div key={modality} className="flex gap-2">
                            <dt className="w-24 shrink-0 font-medium text-gray-600">
                                {MEDIA_MODALITY_LABELS[modality]}
                            </dt>
                            <dd className="text-gray-700">
                                {capability.modelCode ? (
                                    <>
                                        <code>{capability.modelCode}</code> ·{' '}
                                        {capability.unitLabel} por unidade
                                    </>
                                ) : (
                                    <span className="text-amber-700">
                                        {capability.reason}
                                    </span>
                                )}
                            </dd>
                        </div>
                    );
                })}
            </dl>

            <p className="text-[11px] text-gray-400">
                Os preços são estimados por artefacto (imagem por imagem, vídeo
                por segundo, áudio por caracteres). São valores aproximados,
                suficientes para decidir antes de gerar — não uma factura.
            </p>

            {error && (
                <p className="text-xs text-red-700">{error}</p>
            )}
        </div>
    );
}