import { useEffect, useMemo, useState } from 'react';
import { CONTENT_TYPE_LABELS } from '@/lib/ai/content-prompts';
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
 * Cada tipo tem um editor com "Guardar" e "Restaurar padrão" (volta ao default
 * em código).
 */
export function SystemPromptsEditor({
    scope,
    workspace,
    readOnly = false,
}: SystemPromptsEditorProps) {
    const [values, setValues] = useState<Record<string, string>>({});
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
                const overrides =
                    scope === 'workspace' && workspace
                        ? await getWorkspaceSystemPrompts(workspace.id)
                        : await getSystemPrompts('user');

                const initial: Record<string, string> = {};
                for (const o of overrides) {
                    initial[o.contentType] = o.systemPrompt;
                }
                // Valores guardados existentes prevalecem sobre os defaults.
                const merged: Record<string, string> = {};
                for (const ct of contentTypes) {
                    merged[ct.key] = initial[ct.key] ?? '';
                }
                if (!cancelled) {
                    setValues(merged);
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
            await upsertSystemPrompt({
                scope,
                workspaceId: scope === 'workspace' ? workspace?.id : undefined,
                contentType: key,
                systemPrompt: values[key],
            });
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
            setValues((prev) => ({ ...prev, [key]: '' }));
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
                    const isCustom = !!values[ct.key]?.trim();
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
                                            : 'Usa o padrão do sistema'}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {isCustom && (
                                        <button
                                            type="button"
                                            disabled={readOnly || savingKey !== null}
                                            onClick={() => handleRestore(ct.key)}
                                            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Restaurar padrão
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        disabled={readOnly || savingKey !== null}
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
                                value={values[ct.key] ?? ''}
                                onChange={(e) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        [ct.key]: e.target.value,
                                    }))
                                }
                                disabled={readOnly}
                                rows={5}
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