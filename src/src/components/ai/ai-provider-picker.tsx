import { useAIProviderStore } from '@/stores/ai-provider-store';
import { useMemo, useState } from 'react';
import type { AIProvider } from '@/services/ai-provider.service';

export interface AIProviderSelection {
    providerId: string | null;
    modelCode: string | null;
}

interface AIProviderPickerProps {
    /** Seleção atual (null = usar o padrão do workspace). */
    value: AIProviderSelection | null;
    onChange: (value: AIProviderSelection | null) => void;
    disabled?: boolean;
    /** Mostra a opção de "usar padrão" no seletor. Default: true. */
    allowDefault?: boolean;
}

/**
 * Pickers de provider + modelo para a geração de conteúdo. Usa os providers
 * configurados na conta (BD): os disponíveis são os que têm chave configurada.
 * O valor null representa "usar o padrão do workspace".
 */
export function AIProviderPicker({
    value,
    onChange,
    disabled = false,
    allowDefault = true,
}: AIProviderPickerProps) {
    const providers = useAIProviderStore((s) => s.providers);
    const apiKeys = useAIProviderStore((s) => s.apiKeys);
    const isLoading = useAIProviderStore((s) => s.isLoading);

    const configured = useMemo(
        () =>
            (providers ?? []).filter(
                (p: AIProvider) => p.isActive && !!apiKeys[p.id]
            ),
        [providers, apiKeys]
    );

    const [providerRowId, setProviderRowId] = useState<string>(
        value?.providerId ?? ''
    );
    const [modelCode, setModelCode] = useState<string>(value?.modelCode ?? '');

    // Sincroniza o estado interno com o valor externo durante o render
    // (padrão recomendado em vez de setState dentro de um effect).
    const [syncKey, setSyncKey] = useState({
        providerId: value?.providerId ?? null,
        modelCode: value?.modelCode ?? null,
    });
    if (
        syncKey.providerId !== (value?.providerId ?? null) ||
        syncKey.modelCode !== (value?.modelCode ?? null)
    ) {
        setSyncKey({
            providerId: value?.providerId ?? null,
            modelCode: value?.modelCode ?? null,
        });
        setProviderRowId(value?.providerId ?? '');
        setModelCode(value?.modelCode ?? '');
    }

    const selectedProvider = configured.find((p) => p.id === providerRowId);
    const models = useMemo(
        () => (selectedProvider?.models ?? []).filter((m) => m.isActive),
        [selectedProvider]
    );

    const emit = (nextRowId: string, nextModel: string) => {
        const provider = configured.find((p) => p.id === nextRowId);
        if (!provider || !nextModel) {
            onChange(null);
            return;
        }
        onChange({ providerId: nextRowId, modelCode: nextModel });
    };

    const handleProviderChange = (nextRowId: string) => {
        setProviderRowId(nextRowId);
        // Ao trocar de provider, seleciona o primeiro modelo ativo.
        const provider = configured.find((p) => p.id === nextRowId);
        const firstModel = provider?.models?.find((m) => m.isActive);
        const nextModel = firstModel?.modelCode ?? '';
        setModelCode(nextModel);
        emit(nextRowId, nextModel);
    };

    const handleModelChange = (nextModel: string) => {
        setModelCode(nextModel);
        emit(providerRowId, nextModel);
    };

    const handleClear = () => {
        setProviderRowId('');
        setModelCode('');
        onChange(null);
    };

    if (isLoading) {
        return (
            <div className="text-sm text-gray-400">
                A carregar provedores…
            </div>
        );
    }

    if (configured.length === 0) {
        return (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                Nenhum provedor de IA configurado. Configura um provedor nas{' '}
                <strong>Definições de IA</strong> para gerar conteúdo.
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-end gap-3">
                {allowDefault && (
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                            Usar padrão
                        </label>
                        <button
                            type="button"
                            onClick={handleClear}
                            disabled={disabled}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                value === null
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                            {value === null ? 'Padrão do workspace' : 'Usar padrão'}
                        </button>
                    </div>
                )}

                <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                        Provedor
                    </label>
                    <select
                        value={providerRowId}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        disabled={disabled}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                    >
                        <option value="">
                            {allowDefault ? 'Padrão do workspace' : 'Selecionar…'}
                        </option>
                        {configured.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedProvider && (
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                            Modelo
                        </label>
                        <select
                            value={modelCode}
                            onChange={(e) => handleModelChange(e.target.value)}
                            disabled={disabled}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                        >
                            {models.map((m) => (
                                <option key={m.modelCode} value={m.modelCode}>
                                    {m.displayName}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}