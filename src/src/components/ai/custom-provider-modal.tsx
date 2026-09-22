import { useState } from 'react';
import { ConfigFields } from '@/components/ai/config-fields';
import { Modal } from '@/components/ui/modal';
import type { AIProviderConfigOptions } from '@/lib/ai/types';
import type { AIProvider } from '@/services/ai-provider.service';

interface CustomProviderModalProps {
    isOpen: boolean;
    onClose: () => void;
    provider?: AIProvider | null;
    scope: 'user' | 'workspace';
    onSave: (data: {
        name: string;
        baseUrl: string;
        description?: string;
        apiKey: string;
        config: AIProviderConfigOptions;
        models: {
            displayName: string;
            modelCode: string;
            config: AIProviderConfigOptions;
        }[];
        headers: { key: string; value: string }[];
    }) => void;
    /** O teste de conexão é por modelo: passa o modelCode do modelo testado. */
    onTest: (
        modelCode: string,
        apiKey: string,
        baseUrl: string,
        headers: { key: string; value: string }[]
    ) => Promise<{ success: boolean; error?: string }>;
    existingApiKey?: string | null;
}

interface ModelInput {
    displayName: string;
    modelCode: string;
    config: AIProviderConfigOptions;
}

interface HeaderInput {
    key: string;
    value: string;
}

export function CustomProviderModal({
    isOpen,
    onClose,
    provider,
    scope,
    onSave,
    onTest,
    existingApiKey,
}: CustomProviderModalProps) {
    const [name, setName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [description, setDescription] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [config, setConfig] = useState<AIProviderConfigOptions>({});
    const [models, setModels] = useState<ModelInput[]>([
        { displayName: '', modelCode: '', config: {} },
    ]);
    const [headers, setHeaders] = useState<HeaderInput[]>([]);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        error?: string;
    } | null>(null);
    const [expandedModelConfig, setExpandedModelConfig] = useState<
        Record<number, boolean>
    >({});

    // Sincroniza o estado do formulário com o provider selecionado ajustando o
    // estado durante o render (padrão recomendado em vez de setState em effect).
    const [syncKey, setSyncKey] = useState({
        providerId: provider?.id ?? null,
        existingApiKey,
        isOpen,
    });
    if (
        syncKey.providerId !== (provider?.id ?? null) ||
        syncKey.existingApiKey !== existingApiKey ||
        syncKey.isOpen !== isOpen
    ) {
        setSyncKey({
            providerId: provider?.id ?? null,
            existingApiKey,
            isOpen,
        });

        if (provider) {
            setName(provider.name);
            setBaseUrl(provider.baseUrl ?? '');
            setDescription(provider.description ?? '');
            setApiKey(existingApiKey ?? '');
            setConfig(provider.config ?? {});
            setModels(
                provider.models && provider.models.length > 0
                    ? provider.models.map((m) => ({
                          displayName: m.displayName,
                          modelCode: m.modelCode,
                          config: m.config ?? {},
                      }))
                    : [{ displayName: '', modelCode: '', config: {} }]
            );
            setHeaders(
                provider.headers && provider.headers.length > 0
                    ? provider.headers.map((h) => ({
                          key: h.key,
                          value: h.value,
                      }))
                    : []
            );
        } else {
            setName('');
            setBaseUrl('');
            setDescription('');
            setApiKey('');
            setConfig({});
            setModels([{ displayName: '', modelCode: '', config: {} }]);
            setHeaders([]);
        }
        setExpandedModelConfig({});
        setTestResult(null);
    }

    const addModel = () => {
        setModels([
            ...models,
            { displayName: '', modelCode: '', config: {} },
        ]);
    };

    const removeModel = (index: number) => {
        if (models.length <= 1) return;
        setModels(models.filter((_, i) => i !== index));
    };

    const updateModel = (
        index: number,
        field: keyof Omit<ModelInput, 'config'>,
        value: string
    ) => {
        const updated = [...models];
        updated[index][field] = value;
        setModels(updated);
    };

    const updateModelConfig = (
        index: number,
        config: AIProviderConfigOptions
    ) => {
        const updated = [...models];
        updated[index].config = config;
        setModels(updated);
    };

    const addHeader = () => {
        setHeaders([...headers, { key: '', value: '' }]);
    };

    const removeHeader = (index: number) => {
        setHeaders(headers.filter((_, i) => i !== index));
    };

    const updateHeader = (
        index: number,
        field: keyof HeaderInput,
        value: string
    ) => {
        const updated = [...headers];
        updated[index][field] = value;
        setHeaders(updated);
    };

    const handleTest = async () => {
        if (!apiKey.trim() || !baseUrl.trim()) return;
        const validModels = models.filter(
            (m) => m.displayName.trim() && m.modelCode.trim()
        );
        const testModel = validModels[0];
        if (!testModel) {
            setTestResult({
                success: false,
                error: 'Adiciona pelo menos um modelo para testar a conexão',
            });
            return;
        }
        setIsTesting(true);
        setTestResult(null);
        const validHeaders = headers.filter(
            (h) => h.key.trim() && h.value.trim()
        );
        const result = await onTest(
            testModel.modelCode,
            apiKey,
            baseUrl,
            validHeaders
        );
        setTestResult(result);
        setIsTesting(false);
    };

    const handleSave = () => {
        const validModels = models.filter(
            (m) => m.displayName.trim() && m.modelCode.trim()
        );
        const validHeaders = headers.filter(
            (h) => h.key.trim() && h.value.trim()
        );

        onSave({
            name: name.trim(),
            baseUrl: baseUrl.trim(),
            description: description.trim() || undefined,
            apiKey,
            config,
            models: validModels,
            headers: validHeaders,
        });
        onClose();
    };

    const isValid =
        name.trim() &&
        baseUrl.trim() &&
        apiKey.trim() &&
        models.some(
            (m) => m.displayName.trim() && m.modelCode.trim()
        );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={provider ? 'Editar Provedor Customizado' : 'Novo Provedor Customizado'}
            size="lg"
        >
            <div className="space-y-6">
                {/* Scope */}
                <div className={`rounded-md p-3 text-sm ${scope === 'workspace' ? 'bg-indigo-50 text-indigo-800' : 'bg-gray-50 text-gray-700'}`}>
                    {scope === 'workspace' ? (
                        <span className="flex items-center gap-2">
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>
                                <strong>Provedor do workspace</strong> — visível a todos os membros. Só o proprietário do workspace gere estes provedores. A chave fica cifrada e só o teu utilizador a pode descifrar.
                            </span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>
                                <strong>Provedor pessoal</strong> — só tu o vês e só os teus conteúdos o usam.
                            </span>
                        </span>
                    )}
                </div>

                {/* Name */}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Nome *
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Minha Empresa AI"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                {/* Base URL */}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        URL Base *
                    </label>
                    <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://api.example.com/v1"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                {/* API Key */}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        API Key *
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                                setTestResult(null);
                            }}
                            placeholder="Insira a API Key"
                            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={!apiKey.trim() || !baseUrl.trim() || isTesting}
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
                                'Testar Conexão'
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

                {/* Description */}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Descrição
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        placeholder="Notas internas sobre o provedor..."
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                {/* Configuração padrão do provider */}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Configuração padrão
                    </label>
                    <ConfigFields value={config} onChange={setConfig} />
                </div>

                {/* Models */}
                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                            Modelos *
                        </label>
                        <button
                            type="button"
                            onClick={addModel}
                            className="inline-flex items-center gap-1 rounded-md bg-white border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Adicionar
                        </button>
                    </div>
                    <div className="space-y-2">
                        {models.map((model, index) => (
                            <div key={index} className="rounded-md border border-gray-100 p-2">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={model.displayName}
                                        onChange={(e) => updateModel(index, 'displayName', e.target.value)}
                                        placeholder="Nome de exibição"
                                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={model.modelCode}
                                        onChange={(e) => updateModel(index, 'modelCode', e.target.value)}
                                        placeholder="Código do modelo"
                                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedModelConfig({
                                                ...expandedModelConfig,
                                                [index]:
                                                    !expandedModelConfig[index],
                                            })
                                        }
                                        title="Configuração do modelo"
                                        className={`rounded-md p-2 transition-colors ${
                                            expandedModelConfig[index]
                                                ? 'bg-blue-50 text-blue-600'
                                                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                                        }`}
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeModel(index)}
                                        disabled={models.length <= 1}
                                        className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                                {expandedModelConfig[index] && (
                                    <div className="mt-2">
                                        <ConfigFields
                                            value={model.config}
                                            onChange={(next) =>
                                                updateModelConfig(index, next)
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Headers */}
                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                            Headers Customizados
                        </label>
                        <button
                            type="button"
                            onClick={addHeader}
                            className="inline-flex items-center gap-1 rounded-md bg-white border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Adicionar
                        </button>
                    </div>
                    {headers.length === 0 ? (
                        <p className="text-xs text-gray-500">
                            Nenhum header customizado. Adicione se o provedor precisar de headers especiais.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {headers.map((header, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={header.key}
                                        onChange={(e) => updateHeader(index, 'key', e.target.value)}
                                        placeholder="Chave"
                                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={header.value}
                                        onChange={(e) => updateHeader(index, 'value', e.target.value)}
                                        placeholder="Valor"
                                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeHeader(index)}
                                        className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
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
                        disabled={!isValid}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                        {provider ? 'Guardar' : 'Criar Provedor'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}