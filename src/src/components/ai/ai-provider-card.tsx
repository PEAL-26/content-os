import type { AIProvider } from '@/services/ai-provider.service';

interface AIProviderCardProps {
    provider: AIProvider;
    hasApiKey: boolean;
    isDefault: boolean;
    onConfigure: () => void;
    onDelete?: () => void;
    onRemoveApiKey?: () => void;
    canDelete: boolean;
}

const PROVIDER_ICONS: Record<string, string> = {
    anthropic: '🤖',
    openai: '🧠',
    google: '💎',
    opencode: '⚡',
    groq: '🚀',
    deepseek: '🔍',
    cerebras: '🧠',
    together: '🌐',
    openrouter: '🔗',
    nvidia: '🟢',
    ollama: '💻',
};

export function AIProviderCard({
    provider,
    hasApiKey,
    isDefault,
    onConfigure,
    onDelete,
    onRemoveApiKey,
    canDelete,
}: AIProviderCardProps) {
    const icon = provider.isCustom ? '🔧' : PROVIDER_ICONS[provider.providerId] ?? '🤖';

    // Uma chave está "guardada" quando a linha tem ciphertext (apiKeyEncrypted/apiKeyIv)
    // — independentemente de estar descifrada em memória (apiKeys). Só assim o botão
    // "Remover chave" serve de escape hatch nos cenários de password errada ou chave
    // corrompida, em que apiKeys[] está vazio mas a chave continua guardada na BD.
    const hasStoredKey = !!(provider.apiKeyEncrypted && provider.apiKeyIv);

    return (
        <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-gray-300 transition-colors">
            {/* Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl">
                <span>{icon}</span>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-gray-900">
                        {provider.name}
                    </h3>
                    {isDefault && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 shrink-0">
                            Padrão
                        </span>
                    )}
                    {provider.isCustom && (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 shrink-0">
                            Custom
                        </span>
                    )}
                </div>

                {provider.description && (
                    <p className="truncate text-xs text-gray-500 mt-0.5">
                        {provider.description}
                    </p>
                )}

                {provider.models && provider.models.length > 0 && (
                    <p className="truncate text-xs text-gray-400 mt-0.5">
                        Modelos: {provider.models.map(m => m.displayName).join(', ')}
                    </p>
                )}
            </div>

            {/* Status */}
            <div className="shrink-0 text-right">
                {hasApiKey ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Configurado
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Sem chave
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    onClick={onConfigure}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                    Configurar
                </button>
                {hasStoredKey && onRemoveApiKey && (
                    <button
                        type="button"
                        onClick={onRemoveApiKey}
                        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                        title="Remove a chave guardada deste provedor sem precisar da password (útil se a password estiver errada ou a chave corrompida)"
                    >
                        Remover chave
                    </button>
                )}
                {canDelete && onDelete && (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="rounded-md border border-red-200 bg-white p-1.5 text-gray-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar provedor"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
