import { useEffect, useMemo, useState } from 'react';
import { CONTENT_TYPE_LABELS } from '@/lib/ai/content-prompts';
import { buildDefaultSystemPrompt } from '@/lib/ai/default-system-prompts';
import {
    deleteSystemPrompt,
    getSystemPrompts,
    getWorkspaceSystemPrompts,
    upsertSystemPrompt,
    type SystemPromptScope,
} from '@/services/ai-prompt.service';
import type { Workspace } from '@/types/database';

interface SystemPromptsEditorProps {
    scope: SystemPromptScope;
    workspace?: Workspace | null;
    /** Desativa a edição (ex: membro não-OWNER num workspace). */
    readOnly?: boolean;
}

const CONTENT_TYPES: { key: string; label: string }[] = [
    { key: 'article', label: 'Artigo' },
    ...Object.entries(CONTENT_TYPE_LABELS)
        .filter(([k]) => k !== 'article')
        .map(([k, label]) => ({ key: k, label })),
];

/**
 * Editor dos system prompts globais por tipo de conteúdo (workspace ou user).
 * Os inputs mostram SEMPRE o prompt efetivo: override gravado na BD ou o
 * default em código (pré-preenchido). "Guardar" só fica ativo quando há
 * alterações face ao efetivo atual — gravar cria/atualiza um override;
 * "Restaurar padrão" remove o override e volta ao default em código.
 */
export function SystemPromptsEditor({
    scope,
    workspace,
    readOnly = false,
}: SystemPromptsEditorProps) {
    const [values, setValues] = useState<Record<string, string>>({});
    /** Overrides gravados na BD ('', ou key ausente, = sem override). */
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    /** Defaults em código, derivados do workspace (idioma/tom). */
    const [defaults, setDefaults] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    const contentTypes = useMemo(() => CONTENT_TYPES, []);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setError(null);
            try {
                const rows =
                    scope === 'workspace' && workspace
                        ? await getWorkspaceSystemPrompts(workspace.id)
                        : await getSystemPrompts('user');

                const loadedOverrides: Record<string, string> = {};
                for (const o of rows) {
                    loadedOverrides[o.contentType] = o.systemPrompt;
                }

                const nextDefaults: Record<string, string> = {};
                const nextValues: Record<string, string> = {};
                for (const ct of contentTypes) {
                    nextDefaults[ct.key] = buildDefaultSystemPrompt(
                        ct.key,
                        workspace
                    );
                    const override = loadedOverrides[ct.key]?.trim();
                    nextValues[ct.key] = override
                        ? loadedOverrides[ct.key]
                        : nextDefaults[ct.key];
                }

                if (!cancelled) {
                    setDefaults(nextDefaults);
                    setOverrides(loadedOverrides);
                    setValues(nextValues);
                    setIsLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Erro ao carregar prompts de IA'
                    );
                    setIsLoading(false);
                }
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [scope, workspace, contentTypes]);

    const handleSave = async (key: string) => {
        setSavingKey(key);
        setError(null);
        try {
            const value = values[key] ?? '';
            if (!value.trim()) {
                // Guardar vazio = sem override (o runtime cai no default) →
                // remove a linha e volta a mostrar o predefinido.
                await deleteSystemPrompt({
                    scope,
                    workspaceId:
                        scope === 'workspace' ? workspace?.id : undefined,
                    contentType: key,
                });
                setOverrides((prev) => ({ ...prev, [key]: '' }));
                setValues((prev) => ({ ...prev, [key]: defaults[key] }));
            } else {
                await upsertSystemPrompt({
                    scope,
                    workspaceId:
                        scope === 'workspace' ? workspace?.id : undefined,
                    contentType: key,
                    systemPrompt: value,
                });
                setOverrides((prev) => ({ ...prev, [key]: value }));
            }
            setSaved((prev) => ({ ...prev, [key]: true }));
            setTimeout(() => {
                setSaved((prev) => ({ ...prev, [key]: false }));
            }, 2500);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao guardar prompt de IA'
            );
        } finally {
            setSavingKey(null);
        }
    };

    const handleRestore = async (key: string) => {
        setSavingKey(key);
        setError(null);
        try {
            await deleteSystemPrompt({
                scope,
                workspaceId: scope === 'workspace' ? workspace?.id : undefined,
                contentType: key,
            });
            setOverrides((prev) => ({ ...prev, [key]: '' }));
            setValues((prev) => ({ ...prev, [key]: defaults[key] }));
            setSaved((prev) => ({ ...prev, [key]: true }));
            setTimeout(() => {
                setSaved((prev) => ({ ...prev, [key]: false }));
            }, 2500);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao repor prompt padrão'
            );
        } finally {
            setSavingKey(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {readOnly && (
                <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                    Só o proprietário do workspace pode editar os prompts do
                    workspace. Os teus prompts pessoais continuam a aplicar-se.
                </div>
            )}

            <div className="space-y-4">
                {contentTypes.map((ct) => {
                    const overrideValue = (overrides[ct.key] ?? '').trim();
                    const isCustom = overrideValue.length > 0;
                    const baseline = isCustom
                        ? overrides[ct.key]
                        : defaults[ct.key];
                    const currentValue = values[ct.key] ?? '';
                    const isDirty = currentValue !== baseline;
                    const savedOk = saved[ct.key];

                    return (
                        <div
                            key={ct.key}
                            className="rounded-lg border border-gray-200 bg-white p-4"
                        >
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">
                                        {ct.label}
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {isCustom
                                            ? 'Prompt personalizado ativo'
                                            : 'Prompt predefinido — edita e guarda para personalizar'}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {isCustom && (
                                        <button
                                            type="button"
                                            disabled={
                                                readOnly || savingKey !== null
                                            }
                                            onClick={() =>
                                                handleRestore(ct.key)
                                            }
                                            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Restaurar padrão
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        disabled={
                                            readOnly ||
                                            savingKey !== null ||
                                            !isDirty
                                        }
                                        onClick={() => handleSave(ct.key)}
                                        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {savingKey === ct.key
                                            ? 'A guardar…'
                                            : savedOk
                                              ? 'Guardado ✓'
                                              : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={currentValue}
                                onChange={(e) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        [ct.key]: e.target.value,
                                    }))
                                }
                                disabled={readOnly}
                                rows={8}
                                placeholder="Deixa em branco para usar o prompt padrão. Escreve o prompt do sistema (função, regras e formato)."
                                className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}