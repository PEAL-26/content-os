import {
    MODEL_MODALITIES,
    MODEL_MODALITY_LABELS,
    type ModelModality,
} from '@/types/database';
import { curatedModalities } from '@/lib/ai/model-modalities';

// =============================================================================
// Editor das MODALIDADES de um modelo.
//
// É o que dá ao dispatcher a informação "este modelo gera imagem": sem
// modalidades declaradas, `resolveMediaModel` não encontra nenhum candidato e
// o botão de gerar artefacto aparece desactivado.
//
// As modalidades que o catálogo curado sugere vêm pré-marcadas — mas são só
// uma sugestão: o checkbox está sempre disponível, porque um modelo novo
// (ainda não no catálogo) precisa de ser marcado à mão, e um modelo conhecido
// pode ser usado de formas que o catálogo não prevê.
// =============================================================================

export interface ModelModalitiesEditorProps {
    /** O `modelCode` é o que o catálogo curado conhece. */
    modelCode: string;
    value: string[];
    onChange: (modalities: string[]) => void;
    disabled?: boolean;
}

export function ModelModalitiesEditor({
    modelCode,
    value,
    onChange,
    disabled = false,
}: ModelModalitiesEditorProps) {
    const suggested = curatedModalities(modelCode);
    const selected = new Set(value);

    const toggle = (modality: ModelModality) => {
        const next = new Set(selected);
        if (next.has(modality)) {
            next.delete(modality);
        } else {
            next.add(modality);
        }
        onChange([...next]);
    };

    return (
        <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">
                Que dados este modelo produz?
            </span>

            <div className="flex flex-wrap gap-1.5">
                {MODEL_MODALITIES.map((modality) => {
                    const isSelected = selected.has(modality);
                    const isSuggested =
                        suggested.includes(modality) && !isSelected;
                    return (
                        <button
                            key={modality}
                            type="button"
                            onClick={() => toggle(modality)}
                            disabled={disabled}
                            title={
                                isSuggested
                                    ? `Sugerido pelo catálogo para ${modelCode}`
                                    : undefined
                            }
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                isSelected
                                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                            }`}
                        >
                            {MODEL_MODALITY_LABELS[modality]}
                            {isSuggested && (
                                <span className="ml-1 opacity-60">·</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {suggested.length > 0 && (
                <p className="mt-1 text-[10px] text-gray-400">
                    O catálogo sugere{' '}
                    {suggested
                        .map((m) => MODEL_MODALITY_LABELS[m])
                        .join(', ')}{' '}
                    para este modelo. Sem modalidades marcadas, este modelo não
                    é escolhido para gerar artefactos.
                </p>
            )}
        </div>
    );
}