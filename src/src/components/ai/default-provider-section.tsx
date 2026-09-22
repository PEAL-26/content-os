import type { AIProvider } from '@/services/ai-provider.service';

interface DefaultProviderSectionProps {
    providers: AIProvider[];
    defaultProviderId: string | null;
    defaultModelCode: string | null;
    apiKeys: Record<string, string>;
    onSetDefault: (providerId: string, modelCode: string) => void;
}

export function DefaultProviderSection({
    providers,
    defaultProviderId,
    defaultModelCode,
    apiKeys,
    onSetDefault,
}: DefaultProviderSectionProps) {
    const activeProviders = providers.filter(p => p.isActive && apiKeys[p.id]);
    const selectedProvider = activeProviders.find(p => p.id === defaultProviderId);
    const availableModels = selectedProvider?.models?.filter(m => m.isActive) ?? [];

    const handleProviderChange = (providerRowId: string) => {
        const provider = activeProviders.find(p => p.id === providerRowId);
        const firstModel = provider?.models?.find(m => m.isActive);
        if (firstModel) {
            onSetDefault(providerRowId, firstModel.modelCode);
        }
    };

    const handleModelChange = (modelCode: string) => {
        if (defaultProviderId) {
            onSetDefault(defaultProviderId, modelCode);
        }
    };

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                    Provedor Padrão
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Selecione o provedor e modelo que serão usados por defeito para gerar conteúdo.
                </p>
            </div>

            {activeProviders.length === 0 ? (
                <div className="rounded-md bg-yellow-50 p-4">
                    <p className="text-sm text-yellow-800">
                        Nenhum provedor configurado. Configure pelo menos um provedor com API Key acima.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Provedor
                        </label>
                        <select
                            value={defaultProviderId ?? ''}
                            onChange={(e) => handleProviderChange(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="">Selecione um provedor</option>
                            {activeProviders.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Modelo
                        </label>
                        <select
                            value={defaultModelCode ?? ''}
                            onChange={(e) => handleModelChange(e.target.value)}
                            disabled={!defaultProviderId}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                        >
                            <option value="">Selecione um modelo</option>
                            {availableModels.map((m) => (
                                <option key={m.modelCode} value={m.modelCode}>
                                    {m.displayName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {defaultProviderId && defaultModelCode && (
                <div className="mt-4 rounded-md bg-green-50 p-3">
                    <p className="flex items-center gap-2 text-sm text-green-700">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Provedor padrão: <strong>{selectedProvider?.name}</strong> — Modelo: <strong>{availableModels.find(m => m.modelCode === defaultModelCode)?.displayName}</strong>
                    </p>
                </div>
            )}
        </div>
    );
}
