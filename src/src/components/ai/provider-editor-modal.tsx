import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfigFields } from '@/components/ai/config-fields';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Modal } from '@/components/ui/modal';
import type { AIProviderConfigOptions } from '@/lib/ai/types';
import type { AIProvider, AIProviderModel } from '@/services/ai-provider.service';
import { ModelModalitiesEditor } from '@/components/ai/model-modalities-editor';

export interface ModelDraft {
    displayName: string;
    modelCode: string;
    config: AIProviderConfigOptions;
    isActive: boolean;
    /**
     * Que dados o modelo produz. É o que o dispatcher usa para escolher quem
     * gera cada artefacto — sem isto, nenhum modelo é candidato.
     */
    modalities: string[];
}

export interface HeaderDraft {
    key: string;
    value: string;
}

export interface ProviderSaveData {
    name: string;
    baseUrl: string;
    description?: string;
    /**
     * `undefined` = **deixar a chave como está**. Só vem preenchido quando o
     * utilizador escreve algo no campo — é o que permite editar o resto do
     * provedor sem ter de reintroduzir a chave.
     */
    apiKey?: string;
    config: AIProviderConfigOptions;
    models: ModelDraft[];
    headers: HeaderDraft[];
}

interface ProviderEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** `null` = criar um provider customizado novo. */
    providerId: string | null;
    scope: 'user' | 'workspace';
    /** Membro que não é owner do workspace: tudo desativado, sem acções. */
    readOnly?: boolean;
    /** Default do workspace actual — usado para avisar sobre o modelo default. */
    workspaceDefault?: {
        providerId: string | null;
        modelCode: string | null;
    };
    /** Refetch da BD. Devolve `null` se o provider já não existir. */
    onLoad: (providerId: string) => Promise<AIProvider | null>;
    onSave: (
        data: ProviderSaveData
    ) => Promise<{ success: boolean; error?: string }>;
    /** Testa um modelo do rascunho com os valores actuais do formulário. */
    onTest: (
        model: AIProviderModel,
        apiKey: string,
        baseUrl: string,
        headers: HeaderDraft[],
        providerName: string
    ) => Promise<{ success: boolean; error?: string }>;
    onRemoveApiKey: () => Promise<{ success: boolean; error?: string }>;
}

interface ModelRow extends ModelDraft {
    /** Chave estável para o React — o índice não serve (reordenar/apagar
     *  reutilizava o state dos inputs). */
    rowKey: string;
    /** id da linha na BD — `null` enquanto o modelo não foi guardado. */
    id: string | null;
}

interface HeaderRow extends HeaderDraft {
    rowKey: string;
}

interface FormValues {
    name: string;
    baseUrl: string;
    description: string;
    config: AIProviderConfigOptions;
    models: ModelRow[];
    headers: HeaderRow[];
}

type LoadStatus = 'loading' | 'ready' | 'error';

const EMPTY_MODEL: Omit<ModelRow, 'rowKey'> = {
    id: null,
    displayName: '',
    modelCode: '',
    config: {},
    isActive: true,
    // Um modelo novo nasce sem modalidades: o utilizador marca-as, e o
    // servidor preenche pelo catálogo curado se o `modelCode` for conhecido.
    modalities: [],
};

function isValidUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Uma chave é utilizável quando `apiKeyEncrypted` tem texto **e** não tem IV.
 * Com IV é uma chave legacy cifrada com a password antiga, que já não é
 * descifrável (`ai-provider-key.service.ts:73`) — tratá-la como ausente evita
 * prometer um "Testar" que não vai funcionar.
 */
function usableKeyOf(provider: AIProvider | null): string | null {
    if (!provider?.apiKeyEncrypted) return null;
    if (provider.apiKeyIv) return null;
    return provider.apiKeyEncrypted;
}

/**
 * Projecção comparável do formulário — base do guard de alterações.
 * `rowKey` fica de fora de propósito: é interno do React e muda quando uma
 * linha é removida, o que tornaria o formulário "sujo" sem o utilizador ter
 * mudado nada.
 */
function serialize(values: FormValues, apiKey: string): string {
    return JSON.stringify({
        name: values.name,
        baseUrl: values.baseUrl,
        description: values.description,
        config: values.config,
        models: values.models.map((m) => ({
            displayName: m.displayName,
            modelCode: m.modelCode,
            config: m.config,
            isActive: m.isActive,
            // Entra na serialização para que mexer nas modalidades marque o
            // formulário como "sujo" — sem isto, a alteração não chegava ao
            // servidor.
            modalities: m.modalities,
        })),
        headers: values.headers.map((h) => ({ key: h.key, value: h.value })),
        apiKey: apiKey.trim(),
    });
}

export function ProviderEditorModal({
    isOpen,
    onClose,
    providerId,
    scope,
    readOnly = false,
    workspaceDefault,
    onLoad,
    onSave,
    onTest,
    onRemoveApiKey,
}: ProviderEditorModalProps) {
    const isEditing = providerId !== null;

    const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState<AIProvider | null>(null);

    const [values, setValues] = useState<FormValues>({
        name: '',
        baseUrl: '',
        description: '',
        config: {},
        models: [{ ...EMPTY_MODEL, rowKey: 'seed-0' }],
        headers: [],
    });
    const [apiKey, setApiKey] = useState('');
    const [baseline, setBaseline] = useState('');

    const [expandedModelConfig, setExpandedModelConfig] = useState<
        Record<string, boolean>
    >({});
    const [testingRow, setTestingRow] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<
        Record<string, { success: boolean; error?: string }>
    >({});

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [confirmRemoveKey, setConfirmRemoveKey] = useState(false);
    const [isRemovingKey, setIsRemovingKey] = useState(false);
    const [keyError, setKeyError] = useState<string | null>(null);

    const rowCounter = useRef(0);
    const nextRowKey = () => `row${++rowCounter.current}`;

    const patch = useCallback((next: Partial<FormValues>) => {
        setValues((prev) => ({ ...prev, ...next }));
    }, []);

    // -------------------------------------------------------------------------
    // Carregamento — refetch da BD ao abrir (decisão 3)
    // -------------------------------------------------------------------------

    const applyProvider = useCallback(
        (provider: AIProvider | null) => {
            const next: FormValues = provider
                ? {
                      name: provider.name ?? '',
                      baseUrl: provider.baseUrl ?? '',
                      description: provider.description ?? '',
                      config: provider.config ?? {},
                      models:
                          provider.models && provider.models.length > 0
                              ? provider.models.map((m) => ({
                                    rowKey: nextRowKey(),
                                    id: m.id,
                                    displayName: m.displayName,
                                    modelCode: m.modelCode,
                                    config: m.config ?? {},
                                    isActive: m.isActive,
                                    modalities: m.modalities ?? [],
                                }))
                              : [
                                    {
                                        ...EMPTY_MODEL,
                                        rowKey: nextRowKey(),
                                    },
                                ],
                      headers:
                          provider.headers && provider.headers.length > 0
                              ? provider.headers.map((h) => ({
                                    rowKey: nextRowKey(),
                                    key: h.key,
                                    value: h.value,
                                }))
                              : [],
                  }
                : {
                      name: '',
                      baseUrl: '',
                      description: '',
                      config: {},
                      models: [
                          { ...EMPTY_MODEL, rowKey: nextRowKey() },
                      ],
                      headers: [],
                  };

            setValues(next);
            // A chave NUNCA é pré-preenchida: campo vazio = "deixar como está".
            setApiKey('');
            setBaseline(serialize(next, ''));
            setLoaded(provider);
        },
        []
    );

    const load = useCallback(async () => {
        if (providerId === null) {
            setLoadStatus('ready');
            setLoadError(null);
            applyProvider(null);
            return;
        }

        setLoadStatus('loading');
        setLoadError(null);
        try {
            const provider = await onLoad(providerId);
            if (!provider) {
                setLoadStatus('error');
                setLoadError(
                    'Este provedor já não existe. Pode ter sido eliminado noutro separador.'
                );
                return;
            }
            setExpandedModelConfig({});
            setTestResults({});
            setSaveError(null);
            setKeyError(null);
            applyProvider(provider);
            setLoadStatus('ready');
        } catch (err) {
            setLoadStatus('error');
            setLoadError(
                err instanceof Error
                    ? err.message
                    : 'Não foi possível carregar este provedor.'
            );
        }
    }, [providerId, onLoad, applyProvider]);

    useEffect(() => {
        if (!isOpen) return;
        void load();
    }, [isOpen, load]);

    // -------------------------------------------------------------------------
    // Guard de alterações por guardar (decisão 9)
    //
    // Não é preciso tocar no `Modal`: tanto o Escape (`modal.tsx:33`) como o
    // clique no backdrop (`:61`) passam por `onClose` — basta interceptar aqui.
    // -------------------------------------------------------------------------

    const isDirty =
        baseline !== '' && baseline !== serialize(values, apiKey);

    const requestClose = () => {
        if (isDirty && !isSaving) {
            setConfirmDiscard(true);
            return;
        }
        onClose();
    };

    // -------------------------------------------------------------------------
    // Validação (decisão 12)
    // -------------------------------------------------------------------------

    const validation = useMemo(() => {
        const errors: Record<string, string> = {};

        if (!values.name.trim()) {
            errors.name = 'O nome é obrigatório.';
        }

        const url = values.baseUrl.trim();
        if (!url) {
            errors.baseUrl = 'A URL base é obrigatória.';
        } else if (!isValidUrl(url)) {
            errors.baseUrl =
                'URL inválida. Tem de começar por http:// ou https://';
        }

        const complete = values.models.filter(
            (m) => m.displayName.trim() && m.modelCode.trim()
        );

        if (values.models.some((m) => !m.displayName.trim() || !m.modelCode.trim())) {
            errors.models =
                'Preenche o nome e o código do modelo em todas as linhas.';
        } else if (complete.length === 0) {
            errors.models = 'Adiciona pelo menos um modelo.';
        } else if (!complete.some((m) => m.isActive)) {
            errors.models =
                'Pelo menos um modelo tem de estar activo — um provedor sem modelos activos não gera nada.';
        }

        // O save faz diff por `modelCode`: duplicados tornariam o diff
        // ambíguo e o `pickModel` não saberia qual escolher.
        const counts = new Map<string, number>();
        for (const m of complete) {
            const code = m.modelCode.trim();
            counts.set(code, (counts.get(code) ?? 0) + 1);
        }
        const duplicated = [...counts.entries()]
            .filter(([, n]) => n > 1)
            .map(([code]) => code);
        if (duplicated.length > 0) {
            errors.models = `Código de modelo repetido: ${duplicated.join(', ')}`;
        }

        const headerCounts = new Map<string, number>();
        for (const h of values.headers) {
            const key = h.key.trim();
            if (!key || !h.value.trim()) continue;
            headerCounts.set(key, (headerCounts.get(key) ?? 0) + 1);
        }
        const dupHeaders = [...headerCounts.entries()]
            .filter(([, n]) => n > 1)
            .map(([key]) => key);
        if (dupHeaders.length > 0) {
            errors.headers = `Header repetido: ${dupHeaders.join(', ')}`;
        }

        return errors;
    }, [values]);

    const hasErrors = Object.keys(validation).length > 0;

    // -------------------------------------------------------------------------
    // Default do workspace (decisão 5)
    // -------------------------------------------------------------------------

    const defaultModelCode =
        workspaceDefault && workspaceDefault.providerId === providerId
            ? workspaceDefault.modelCode
            : null;

    const defaultModelSurvives = useMemo(
        () =>
            !defaultModelCode ||
            values.models.some(
                (m) => m.modelCode.trim() === defaultModelCode && m.isActive
            ),
        [defaultModelCode, values.models]
    );

    const fallbackModel = useMemo(
        () =>
            values.models.find(
                (m) => m.isActive && m.displayName.trim() && m.modelCode.trim()
            ),
        [values.models]
    );

    // -------------------------------------------------------------------------
    // Acções
    // -------------------------------------------------------------------------

    const storedKey = usableKeyOf(loaded);
    const effectiveKey = apiKey.trim() || storedKey;

    const addModel = () => {
        patch({
            models: [
                ...values.models,
                { ...EMPTY_MODEL, rowKey: nextRowKey() },
            ],
        });
    };

    const removeModel = (rowKey: string) => {
        patch({ models: values.models.filter((m) => m.rowKey !== rowKey) });
        setTestResults((prev) => {
            const next = { ...prev };
            delete next[rowKey];
            return next;
        });
    };

    const updateModel = (rowKey: string, delta: Partial<ModelDraft>) => {
        patch({
            models: values.models.map((m) =>
                m.rowKey === rowKey ? { ...m, ...delta } : m
            ),
        });
    };

    const addHeader = () => {
        patch({
            headers: [...values.headers, { rowKey: nextRowKey(), key: '', value: '' }],
        });
    };

    const removeHeader = (rowKey: string) => {
        patch({ headers: values.headers.filter((h) => h.rowKey !== rowKey) });
    };

    const updateHeader = (rowKey: string, delta: Partial<HeaderDraft>) => {
        patch({
            headers: values.headers.map((h) =>
                h.rowKey === rowKey ? { ...h, ...delta } : h
            ),
        });
    };

    const handleTestModel = async (row: ModelRow) => {
        const code = row.modelCode.trim();
        const fail = (error: string) =>
            setTestResults((prev) => ({
                ...prev,
                [row.rowKey]: { success: false, error },
            }));

        if (!code) {
            fail('Preenche o código do modelo para testar.');
            return;
        }
        if (!effectiveKey) {
            fail('Sem API Key — escreve uma chave para testar a conexão.');
            return;
        }

        setTestingRow(row.rowKey);
        try {
            const result = await onTest(
                {
                    id: row.id ?? `draft-${row.rowKey}`,
                    providerId: loaded?.id ?? '',
                    displayName: row.displayName.trim(),
                    modelCode: code,
                    config: row.config,
                    isActive: row.isActive,
                    createdAt: '',
                },
                effectiveKey,
                values.baseUrl.trim(),
                values.headers
                    .filter((h) => h.key.trim() && h.value.trim())
                    .map((h) => ({ key: h.key.trim(), value: h.value.trim() })),
                values.name
            );
            setTestResults((prev) => ({ ...prev, [row.rowKey]: result }));
        } finally {
            setTestingRow(null);
        }
    };

    const handleSave = async () => {
        if (isSaving || hasErrors || readOnly) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            const result = await onSave({
                name: values.name.trim(),
                baseUrl: values.baseUrl.trim(),
                description: values.description.trim() || undefined,
                apiKey: apiKey.trim() || undefined,
                config: values.config,
                models: values.models.map((m) => ({
                    displayName: m.displayName.trim(),
                    modelCode: m.modelCode.trim(),
                    config: m.config,
                    isActive: m.isActive,
                    modalities: m.modalities,
                })),
                headers: values.headers
                    .filter((h) => h.key.trim() && h.value.trim())
                    .map((h) => ({ key: h.key.trim(), value: h.value.trim() })),
            });

            if (!result.success) {
                setSaveError(result.error || 'Erro ao guardar provedor.');
                return;
            }
            onClose();
        } catch (err) {
            setSaveError(
                err instanceof Error
                    ? err.message
                    : 'Erro inesperado ao guardar o provedor.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveKey = async () => {
        setIsRemovingKey(true);
        setKeyError(null);
        try {
            const result = await onRemoveApiKey();
            if (!result.success) {
                setKeyError(result.error || 'Erro ao remover a chave.');
                return;
            }
            setConfirmRemoveKey(false);
            setApiKey('');
            setLoaded((prev) =>
                prev ? { ...prev, apiKeyEncrypted: null, apiKeyIv: null } : prev
            );
        } finally {
            setIsRemovingKey(false);
        }
    };

    const title = isEditing
        ? `Configurar ${loaded?.name ?? 'provedor'}`
        : 'Novo Provedor Customizado';

    const inputClass =
        'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500';
    const iconButtonClass =
        'shrink-0 rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40';

    return (
        <>
            <Modal isOpen={isOpen} onClose={requestClose} title={title} size="xl">
                {loadStatus === 'loading' && (
                    <div className="space-y-4" aria-busy="true">
                        <p className="text-sm text-gray-500">
                            A carregar o provedor…
                        </p>
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-10 animate-pulse rounded-md bg-gray-100"
                            />
                        ))}
                    </div>
                )}

                {loadStatus === 'error' && (
                    <div className="space-y-4">
                        <div className="rounded-md border border-red-200 bg-red-50 p-4">
                            <p className="text-sm text-red-700">{loadError}</p>
                            <p className="mt-1 text-xs text-red-600">
                                O formulário não abre para não guardares por
                                cima de dados que não viste.
                            </p>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => void load()}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    </div>
                )}

                {loadStatus === 'ready' && (
                    <div className="space-y-6">
                        {readOnly && (
                            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                <svg
                                    className="mt-0.5 h-4 w-4 shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <span>
                                    <strong>Apenas leitura.</strong> Este é um
                                    provedor do workspace — só o proprietário o
                                    gere. Podes ver a configuração, mas a chave
                                    usada na geração é a do proprietário, não a
                                    tua.
                                </span>
                            </div>
                        )}

                        {/* Âmbito — informativo, não editável (decisão 7) */}
                        <div
                            className={`rounded-md p-3 text-sm ${
                                scope === 'workspace'
                                    ? 'bg-indigo-50 text-indigo-800'
                                    : 'bg-gray-50 text-gray-700'
                            }`}
                        >
                            {scope === 'workspace' ? (
                                <span className="flex items-start gap-2">
                                    <svg
                                        className="h-4 w-4 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                        />
                                    </svg>
                                    <span>
                                        <strong>Provedor do workspace</strong> —
                                        visível a todos os membros. Só o
                                        proprietário gere. A chave fica
                                        associada à conta de quem a guardou.
                                    </span>
                                </span>
                            ) : (
                                <span className="flex items-start gap-2">
                                    <svg
                                        className="h-4 w-4 shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                    </svg>
                                    <span>
                                        <strong>Provedor pessoal</strong> — só
                                        tu o vês e só os teus conteúdos o usam.
                                    </span>
                                </span>
                            )}
                        </div>

                        {/* Nome */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Nome *
                            </label>
                            <input
                                type="text"
                                value={values.name}
                                onChange={(e) =>
                                    patch({ name: e.target.value })
                                }
                                disabled={readOnly}
                                placeholder="Ex: Minha Empresa AI"
                                className={`w-full ${inputClass}`}
                            />
                            {validation.name && (
                                <p className="mt-1 text-xs text-red-600">
                                    {validation.name}
                                </p>
                            )}
                        </div>

                        {/* URL base */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                URL Base *
                            </label>
                            <input
                                type="url"
                                value={values.baseUrl}
                                onChange={(e) =>
                                    patch({ baseUrl: e.target.value })
                                }
                                disabled={readOnly}
                                placeholder="https://api.example.com/v1"
                                className={`w-full ${inputClass}`}
                            />
                            {validation.baseUrl ? (
                                <p className="mt-1 text-xs text-red-600">
                                    {validation.baseUrl}
                                </p>
                            ) : (
                                <p className="mt-1 text-xs text-gray-400">
                                    Interface OpenAI-compatible. Ex:
                                    https://api.anthropic.com/v1/
                                </p>
                            )}
                        </div>

                        {/* API key (decisão 2) */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                API Key
                            </label>

                            {storedKey ? (
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                        <svg
                                            className="h-3 w-3"
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
                                        Chave configurada
                                        {/* Os últimos caracteres só para quem
                                            gere o provider — num provider de
                                            workspace a chave é do owner, e não
                                            há motivo para a mostrar a quem só
                                            pode ler. */}
                                        {!readOnly && (
                                            <span className="font-mono">
                                                ····{storedKey.slice(-4)}
                                            </span>
                                        )}
                                    </span>
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setConfirmRemoveKey(true)
                                            }
                                            className="text-xs font-medium text-red-600 underline hover:text-red-700"
                                        >
                                            Remover chave
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="mb-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                                    Sem chave — este provedor não pode gerar
                                    conteúdo até teres uma.
                                </p>
                            )}

                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                disabled={readOnly}
                                placeholder={
                                    storedKey
                                        ? 'Deixa vazio para manter a chave actual'
                                        : 'Insere a API Key'
                                }
                                className={`w-full ${inputClass}`}
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                {storedKey
                                    ? 'Escreve aqui só se quiseres substituir a chave guardada.'
                                    : 'A chave é guardada em claro na base de dados.'}
                            </p>

                            {keyError && (
                                <p className="mt-1 text-xs text-red-600">
                                    {keyError}
                                </p>
                            )}
                        </div>

                        {/* Descrição */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Descrição
                            </label>
                            <textarea
                                value={values.description}
                                onChange={(e) =>
                                    patch({ description: e.target.value })
                                }
                                disabled={readOnly}
                                rows={2}
                                placeholder="Notas internas sobre o provedor..."
                                className={`w-full ${inputClass}`}
                            />
                        </div>

                        {/* Config padrão do provider */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Configuração padrão
                            </label>
                            <p className="mb-1 text-xs text-gray-400">
                                Aplicada a todos os modelos, excepto o que cada
                                modelo sobrescreva.
                            </p>
                            <div
                                className={
                                    readOnly
                                        ? 'pointer-events-none opacity-60'
                                        : ''
                                }
                            >
                                <ConfigFields
                                    value={values.config}
                                    onChange={(config) =>
                                        patch({ config })
                                    }
                                />
                            </div>
                        </div>

                        {/* Modelos (decisão 4) */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">
                                    Modelos *
                                </label>
                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={addModel}
                                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                    >
                                        <svg
                                            className="h-3 w-3"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                        Adicionar
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                {values.models.map((model) => {
                                    const testResult =
                                        testResults[model.rowKey];
                                    const isTesting = testingRow === model.rowKey;
                                    const incomplete =
                                        !model.displayName.trim() ||
                                        !model.modelCode.trim();
                                    return (
                                        <div
                                            key={model.rowKey}
                                            className={`rounded-md border p-2 ${
                                                model.isActive
                                                    ? 'border-gray-100'
                                                    : 'border-gray-100 bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <label
                                                    className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-gray-600"
                                                    title={
                                                        model.isActive
                                                            ? 'Desactivar — deixa de aparecer nos selectores e não pode ser usado'
                                                            : 'Activar'
                                                    }
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={model.isActive}
                                                        disabled={readOnly}
                                                        onChange={(e) =>
                                                            updateModel(
                                                                model.rowKey,
                                                                {
                                                                    isActive: e
                                                                        .target
                                                                        .checked,
                                                                }
                                                            )
                                                        }
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                                    />
                                                    <span className="hidden sm:inline">
                                                        Activo
                                                    </span>
                                                </label>

                                                <input
                                                    type="text"
                                                    value={model.displayName}
                                                    disabled={readOnly}
                                                    onChange={(e) =>
                                                        updateModel(
                                                            model.rowKey,
                                                            {
                                                                displayName: e
                                                                    .target
                                                                    .value,
                                                            }
                                                        )
                                                    }
                                                    placeholder="Nome de exibição"
                                                    className={`flex-1 ${inputClass} ${
                                                        incomplete
                                                            ? 'border-red-300'
                                                            : ''
                                                    }`}
                                                />
                                                <input
                                                    type="text"
                                                    value={model.modelCode}
                                                    disabled={readOnly}
                                                    onChange={(e) =>
                                                        updateModel(
                                                            model.rowKey,
                                                            {
                                                                modelCode: e
                                                                    .target
                                                                    .value,
                                                            }
                                                        )
                                                    }
                                                    placeholder="Código do modelo"
                                                    className={`flex-1 ${inputClass} ${
                                                        incomplete
                                                            ? 'border-red-300'
                                                            : ''
                                                    }`}
                                                />

                                                {/* Modalidades: o que decide se
                                                    este modelo pode gerar
                                                    imagem/áudio/vídeo. */}
                                                <div className="w-full basis-full pt-1">
                                                    <ModelModalitiesEditor
                                                        modelCode={
                                                            model.modelCode
                                                        }
                                                        value={
                                                            model.modalities ??
                                                            []
                                                        }
                                                        onChange={(
                                                            modalities
                                                        ) =>
                                                            updateModel(
                                                                model.rowKey,
                                                                {
                                                                    modalities,
                                                                }
                                                            )
                                                        }
                                                        disabled={
                                                            readOnly
                                                        }
                                                    />
                                                </div>

                                                <button
                                                    type="button"
                                                    disabled={
                                                        readOnly ||
                                                        incomplete ||
                                                        !effectiveKey
                                                    }
                                                    onClick={() =>
                                                        void handleTestModel(
                                                            model
                                                        )
                                                    }
                                                    title={
                                                        !effectiveKey
                                                            ? 'Precisa de uma API Key para testar'
                                                            : `Testar ${
                                                                  model.displayName ||
                                                                  model.modelCode
                                                              }`
                                                    }
                                                    className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    {isTesting ? (
                                                        <svg
                                                            className="h-3 w-3 animate-spin"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle
                                                                className="opacity-25"
                                                                cx="12"
                                                                cy="12"
                                                                r="10"
                                                                stroke="currentColor"
                                                                strokeWidth="4"
                                                            />
                                                            <path
                                                                className="opacity-75"
                                                                fill="currentColor"
                                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                                            />
                                                        </svg>
                                                    ) : (
                                                        'Testar'
                                                    )}
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={readOnly}
                                                    onClick={() =>
                                                        setExpandedModelConfig(
                                                            (prev) => ({
                                                                ...prev,
                                                                [model.rowKey]:
                                                                    !prev[
                                                                        model
                                                                            .rowKey
                                                                    ],
                                                            })
                                                        )
                                                    }
                                                    title="Configuração do modelo"
                                                    className={`shrink-0 rounded-md p-2 transition-colors disabled:opacity-40 ${
                                                        expandedModelConfig[
                                                            model.rowKey
                                                        ]
                                                            ? 'bg-blue-50 text-blue-600'
                                                            : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                                                    }`}
                                                >
                                                    <svg
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                                        />
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                        />
                                                    </svg>
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={readOnly}
                                                    onClick={() =>
                                                        removeModel(
                                                            model.rowKey
                                                        )
                                                    }
                                                    title={
                                                        model.id
                                                            ? 'Remover este modelo do provedor'
                                                            : 'Remover esta linha'
                                                    }
                                                    className={iconButtonClass}
                                                >
                                                    <svg
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>

                                            {expandedModelConfig[
                                                model.rowKey
                                            ] && (
                                                <div className="mt-2">
                                                    <ConfigFields
                                                        value={model.config}
                                                        onChange={(config) =>
                                                            updateModel(
                                                                model.rowKey,
                                                                { config }
                                                            )
                                                        }
                                                    />
                                                </div>
                                            )}

                                            {testResult && (
                                                <div
                                                    className={`mt-2 rounded-md p-2 text-xs ${
                                                        testResult.success
                                                            ? 'bg-green-50 text-green-700'
                                                            : 'bg-red-50 text-red-700'
                                                    }`}
                                                >
                                                    {testResult.success
                                                        ? 'Conexão testada com sucesso, com os valores actuais do formulário'
                                                        : testResult.error ||
                                                          'Erro ao testar conexão'}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {validation.models ? (
                                <p className="mt-2 text-xs text-red-600">
                                    {validation.models}
                                </p>
                            ) : (
                                <p className="mt-2 text-xs text-gray-400">
                                    Modelos inactivos continuam guardados mas não
                                    aparecem nos selectores nem podem ser usados
                                    para gerar.
                                </p>
                            )}
                        </div>

                        {/* Default do workspace (decisão 5) — avisa, não bloqueia */}
                        {defaultModelCode && !defaultModelSurvives && (
                            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                <svg
                                    className="mt-0.5 h-4 w-4 shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <span>
                                    <strong>{defaultModelCode}</strong> é o
                                    modelo por defeito deste workspace. A geração
                                    vai passar a usar{' '}
                                    <strong>
                                        {fallbackModel
                                            ? `${fallbackModel.displayName} (${fallbackModel.modelCode})`
                                            : 'nenhum modelo'}
                                    </strong>
                                    . Podes guardar na mesma e mudar o default na
                                    secção "Provedor Padrão".
                                </span>
                            </div>
                        )}

                        {/* Headers */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">
                                    Headers Customizados
                                </label>
                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={addHeader}
                                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                    >
                                        <svg
                                            className="h-3 w-3"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                        Adicionar
                                    </button>
                                )}
                            </div>

                            {values.headers.length === 0 ? (
                                <p className="text-xs text-gray-500">
                                    Nenhum header customizado. Adiciona se o
                                    provedor precisar de headers especiais.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {values.headers.map((header) => (
                                        <div
                                            key={header.rowKey}
                                            className="flex gap-2"
                                        >
                                            <input
                                                type="text"
                                                value={header.key}
                                                disabled={readOnly}
                                                onChange={(e) =>
                                                    updateHeader(
                                                        header.rowKey,
                                                        {
                                                            key: e.target
                                                                .value,
                                                        }
                                                    )
                                                }
                                                placeholder="Chave"
                                                className={`flex-1 ${inputClass}`}
                                            />
                                            <input
                                                type="text"
                                                value={header.value}
                                                disabled={readOnly}
                                                onChange={(e) =>
                                                    updateHeader(
                                                        header.rowKey,
                                                        {
                                                            value: e.target
                                                                .value,
                                                        }
                                                    )
                                                }
                                                placeholder="Valor"
                                                className={`flex-1 ${inputClass}`}
                                            />
                                            <button
                                                type="button"
                                                disabled={readOnly}
                                                onClick={() =>
                                                    removeHeader(
                                                        header.rowKey
                                                    )
                                                }
                                                className={iconButtonClass}
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {validation.headers && (
                                <p className="mt-2 text-xs text-red-600">
                                    {validation.headers}
                                </p>
                            )}
                        </div>

                        {/* Acções */}
                        {(saveError || keyError) && (
                            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {saveError || keyError}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3 pt-4">
                            <p className="text-xs text-gray-400">
                                {isDirty
                                    ? 'Alterações por guardar.'
                                    : 'Sem alterações por guardar.'}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={requestClose}
                                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                >
                                    {isDirty ? 'Descartar' : 'Fechar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleSave()}
                                    disabled={
                                        hasErrors ||
                                        isSaving ||
                                        readOnly ||
                                        !isDirty
                                    }
                                    title={
                                        hasErrors
                                            ? 'Corrige os campos assinalados antes de guardar.'
                                            : undefined
                                    }
                                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                                >
                                    {isSaving
                                        ? 'A guardar…'
                                        : isEditing
                                          ? 'Guardar'
                                          : 'Criar Provedor'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal
                isOpen={confirmDiscard}
                onClose={() => setConfirmDiscard(false)}
                onConfirm={() => {
                    setConfirmDiscard(false);
                    onClose();
                }}
                title="Descartar alterações?"
                message="Tens alterações por guardar neste provedor. Se saíres agora, perdes-as."
                confirmText="Descartar"
                cancelText="Continuar a editar"
                variant="warning"
            />

            <ConfirmModal
                isOpen={confirmRemoveKey}
                onClose={() => setConfirmRemoveKey(false)}
                onConfirm={() => void handleRemoveKey()}
                title="Remover a chave?"
                message="O provedor deixa de conseguir gerar conteúdo até ter uma nova chave. Os modelos e a configuração mantêm-se."
                confirmText="Remover chave"
                variant="danger"
                isLoading={isRemovingKey}
            />
        </>
    );
}