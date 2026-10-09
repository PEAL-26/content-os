import { MEDIA_MODALITIES, MEDIA_MODALITY_LABELS } from '@/types/database';
import type { MediaModality } from '@/types/database';

// =============================================================================
// Definição do MODELO por modalidade de artefacto.
//
// "Automático" = o dispatcher escolhe o primeiro modelo activo que produz a
// modalidade, por `priority` (a mesma cadeia de resolução do texto). Fixar um
// modelo é o que permite, por exemplo, usar um modelo barato para esboços e um
// topo de gama para as peças finais.
// =============================================================================

export interface ArtifactModelSettingsProps {
    /** `{ image?, audio?, video? }` com `modelCode`, ou `null`. */
    value: { image?: string | null; audio?: string | null; video?: string | null } | null;
    /** Modelos candidatos por modalidade (já filtrados por provider activo). */
    optionsByModality: Partial<Record<MediaModality, { modelCode: string; label: string }[]>>;
    onChange: (
        value: { image?: string | null; audio?: string | null; video?: string | null } | null
    ) => void;
    disabled?: boolean;
}

const EMPTY = { image: null, audio: null, video: null } as const;

export function ArtifactModelSettings({
    value,
    optionsByModality,
    onChange,
    disabled = false,
}: ArtifactModelSettingsProps) {
    const current = value ?? EMPTY;

    const update = (modality: MediaModality, modelCode: string) => {
        const next = { ...current, [modality]: modelCode || null };
        // Tudo vazio = `null`, para o servidor ler como "automático nos três".
        const isEmpty = MEDIA_MODALITIES.every((m) => !next[m]);
        onChange(isEmpty ? null : next);
    };

    return (
        <div className="space-y-2">
            <p className="text-xs text-gray-500">
                Modelo que gera cada tipo de ficheiro. <strong>Automático</strong>{' '}
                usa o primeiro modelo activo que produz essa modalidade.
            </p>

            {MEDIA_MODALITIES.map((modality) => {
                const options = optionsByModality[modality] ?? [];
                return (
                    <div key={modality} className="flex items-center gap-2">
                        <label className="w-20 shrink-0 text-xs font-medium text-gray-700">
                            {MEDIA_MODALITY_LABELS[modality]}
                        </label>
                        <select
                            value={current[modality] ?? ''}
                            onChange={(e) => update(modality, e.target.value)}
                            disabled={disabled}
                            className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
                        >
                            <option value="">Automático</option>
                            {options.length === 0 && (
                                <option value="" disabled>
                                    (nenhum modelo desta modalidade)
                                </option>
                            )}
                            {options.map((option) => (
                                <option
                                    key={option.modelCode}
                                    value={option.modelCode}
                                >
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                );
            })}
        </div>
    );
}