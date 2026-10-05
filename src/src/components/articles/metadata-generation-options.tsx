import {
    AIProviderPicker,
    type AIProviderSelection,
} from '@/components/ai/ai-provider-picker';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface MetadataGenerationOptionsProps {
    /** Provider/modelo escolhido (null = default do workspace). */
    preferred: AIProviderSelection | null;
    onPreferredChange: (value: AIProviderSelection | null) => void;
    /** Instruções para a geração (aplicadas a todos os campos). */
    additionalInstructions: string;
    onAdditionalInstructionsChange: (value: string) => void;
    disabled?: boolean;
}

/**
 * "Opções de geração" dos metadados — fechado por defeito.
 *
 * Um único picker e uma única textarea servem os 6 botões (4 por campo + 2
 * globais): provider e instruções são estado do *painel*, não do *campo*. O
 * disclosure existe porque a geração é uma operação de commodity — quem não
 * escolhe nada usa o default do workspace, e quem precisa de um provider
 * específico vai à procura dele em vez de o encontrar por acaso no topo.
 */
export function MetadataGenerationOptions({
    preferred,
    onPreferredChange,
    additionalInstructions,
    onAdditionalInstructionsChange,
    disabled = false,
}: MetadataGenerationOptionsProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="rounded-md border border-gray-200 bg-white">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
                Opções de geração
                {isOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                )}
            </button>

            {isOpen && (
                <div className="space-y-3 border-t border-gray-100 p-3">
                    <div>
                        <label className="mb-1.5 block text-xs text-gray-500">
                            Provedor / Modelo
                        </label>
                        <AIProviderPicker
                            value={preferred}
                            onChange={onPreferredChange}
                            disabled={disabled}
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs text-gray-500">
                            Instruções adicionais
                        </label>
                        <textarea
                            value={additionalInstructions}
                            onChange={(e) =>
                                onAdditionalInstructionsChange(e.target.value)
                            }
                            disabled={disabled}
                            rows={2}
                            placeholder="Indicações extra para esta geração (opcional)..."
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none disabled:bg-gray-50"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}