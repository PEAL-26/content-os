import type { AIProviderConfigOptions } from '@/lib/ai/types';

interface ConfigFieldsProps {
    value: AIProviderConfigOptions;
    onChange: (next: AIProviderConfigOptions) => void;
}

const REASONING_OPTIONS: Array<{
    value: NonNullable<AIProviderConfigOptions['reasoning_effort']>;
    label: string;
}> = [
    { value: 'none', label: 'None' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'XHigh' },
];

/**
 * Campos de configuração (temperature, max_tokens, reasoning_effort).
 * Valores vazios são tratados como "usar o default" (null — não enviados
 * à API). Usado por provider e por modelo.
 */
export function ConfigFields({ value, onChange }: ConfigFieldsProps) {
    return (
        <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                        Temperature
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={value.temperature ?? ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            onChange({
                                ...value,
                                temperature: raw === '' ? null : Number(raw),
                            });
                        }}
                        placeholder="Default"
                        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                        Max Tokens
                    </label>
                    <input
                        type="number"
                        min={1}
                        step={1}
                        value={value.max_tokens ?? ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            onChange({
                                ...value,
                                max_tokens: raw === '' ? null : Number(raw),
                            });
                        }}
                        placeholder="Default"
                        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                </div>
            </div>

            <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                    Reasoning Effort
                </label>
                <select
                    value={value.reasoning_effort ?? ''}
                    onChange={(e) => {
                        const raw = e.target.value;
                        onChange({
                            ...value,
                            reasoning_effort:
                                raw === ''
                                    ? null
                                    : (raw as NonNullable<
                                          AIProviderConfigOptions['reasoning_effort']
                                      >),
                        });
                    }}
                    className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                    <option value="">Default</option>
                    {REASONING_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <p className="text-xs text-gray-400">
                Deixa em branco para usar o default do modelo.
            </p>
        </div>
    );
}