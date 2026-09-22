import { useState } from 'react';
import { ConfigFields } from '@/components/ai/config-fields';
import { Modal } from '@/components/ui/modal';
import type { AIProviderConfigOptions } from '@/lib/ai/types';
import type { AIProvider } from '@/services/ai-provider.service';

interface DefaultProviderModalProps {
    isOpen: boolean;
    onClose: () => void;
    provider: AIProvider;
    currentApiKey: string | null;
    onSave: (data: {
        apiKey: string;
        config: AIProviderConfigOptions;
    }) => void;
    onTest: (
        modelCode: string,
        apiKey: string,
        baseUrl?: string,
        headers?: { key: string; value: string }[]
    ) => Promise<{ success: boolean; error?: string }>;
}

export function DefaultProviderModal({
    isOpen,
    onClose,
    provider,
    currentApiKey,
    onSave,
    onTest,
}: DefaultProviderModalProps) {
    const [apiKey, setApiKey] = useState(currentApiKey ?? '');
    const [config, setConfig] = useState<AIProviderConfigOptions>(
        provider.config ?? {}
    );
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        error?: string;
    } | null>(null);
    const activeModels = provider.models?.filter((m) => m.isActive) ?? [];
    const [selectedModel, setSelectedModel] = useState<string | null>(
        activeModels[0]?.modelCode ?? null
    );

    const handleTest = async () => {
        if (!apiKey.trim()) return;
        if (!selectedModel) {
            setTestResult({
                success: false,
                error: 'Seleciona um modelo para testar a conexão',
            });
            return;
        }
        setIsTesting(true);
        setTestResult(null);
        const result = await onTest(selectedModel, apiKey);
        setTestResult(result);
        setIsTesting(false);
    };

    const handleSave = () => {
        onSave({ apiKey, config });
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Configurar ${provider.name}`}
            size="sm"
        >
            <div className="space-y-4">
                <div>
                    <p className="text-sm text-gray-500">
                        {provider.description}
                    </p>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        API Key
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                                setTestResult(null);
                            }}
                            placeholder="Insira a sua API Key"
                            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={!apiKey.trim() || isTesting}
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isTesting ? (
                                <span className="flex items-center gap-1">
                                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    A testar...
                                </span>
                            ) : (
                                'Testar'
                            )}
                        </button>
                    </div>

                    {testResult && (
                        <div className={`mt-2 rounded-md p-2 text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {testResult.success ? (
                                <span className="flex items-center gap-1">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Conexão testada com sucesso
                                </span>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    {testResult.error || 'Erro ao testar conexão'}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {activeModels.length > 0 && (
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Modelo (o teste de conexão é por modelo)
                        </label>
                        <div className="rounded-md bg-gray-50 p-3">
                            <div className="flex flex-wrap gap-2">
                                {activeModels.map((model) => (
                                    <button
                                        key={model.modelCode}
                                        type="button"
                                        onClick={() => {
                                            setSelectedModel(model.modelCode);
                                            setTestResult(null);
                                        }}
                                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                                            selectedModel === model.modelCode
                                                ? 'border-blue-600 bg-blue-600 text-white'
                                                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                                        }`}
                                    >
                                        {model.displayName}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Configuração padrão do provider */}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Configuração padrão
                    </label>
                    <ConfigFields value={config} onChange={setConfig} />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!apiKey.trim()}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </Modal>
    );
}