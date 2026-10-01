import { useState } from 'react';

// =============================================================================
// Editor de um prompt de peça.
//
// Save explícito (botão "Guardar") — o prompt é longo e o utilizador quer poder
// rever antes de gravar. Cada item ('main', 'slide-2', 'tweet-1') tem o seu
// editor: o 'main' regenera a peça, os itens regeneram só o slide/tweet.
// =============================================================================

export interface PromptEditorProps {
    itemKey: string;
    label: string;
    prompt: string;
    /** Preenchido quando o utilizador editou o prompt à mão. */
    editedAt?: string | null;
    onSave: (itemKey: string, prompt: string) => Promise<boolean>;
    /** Acção secundária ("Gerar este slide" / "Gerar peça com este prompt"). */
    onGenerate?: () => void;
    generateLabel?: string;
    isGenerating?: boolean;
    disabled?: boolean;
}

export function PromptEditor({
    itemKey,
    label,
    prompt,
    editedAt = null,
    onSave,
    onGenerate,
    generateLabel,
    isGenerating = false,
    disabled = false,
}: PromptEditorProps) {
    const [draft, setDraft] = useState(prompt);
    const [isSaving, setIsSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [copied, setCopied] = useState(false);
    // Último prompt recebido por props — usado para resetar o rascunho quando
    // o prompt muda por fora (regenerado pelo job, troca de peça).
    const [loadedPrompt, setLoadedPrompt] = useState(prompt);

    // Compara já normalizado (o servidor grava `prompt.trim()`): sem isto, um
    // prompt gravado com espaço no fim voltava como "alterado" e limpava logo
    // a confirmação de "Guardado".
    const normalize = (value: string) => value.trim();
    const isDirty = normalize(draft) !== normalize(prompt);
    const canGenerate = !isDirty && !isSaving;

    // Sincroniza durante o render (não num effect): evita o cascata de renders
    // e a janela em que o rascunho mostra texto já obsoleto.
    //
    // A confirmação de "Guardado" só se apaga quando a mudança veio de fora.
    // Depois de gravar, o pai relê o prompt e o texto que chega é exactamente
    // o que o utilizador escreveu — se isso limpasse a confirmação, "Guardado
    // às HH:MM" nunca chegaria a aparecer.
    if (normalize(prompt) !== normalize(loadedPrompt)) {
        const changedOutside = normalize(prompt) !== normalize(draft);
        setLoadedPrompt(prompt);
        setDraft(prompt);
        if (changedOutside) setSavedAt(null);
    }

    const handleSave = async () => {
        setIsSaving(true);
        const ok = await onSave(itemKey, draft);
        setIsSaving(false);
        if (ok) {
            setSavedAt(new Date());
        }
    };

    const handleDiscard = () => {
        setDraft(prompt);
        setSavedAt(null);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(draft);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard indisponível (permissões) — o texto continua visível.
        }
    };

    return (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-600">
                    <span className="truncate">{label}</span>
                    {editedAt && (
                        <span
                            title="Editado por ti — ao regenerar este item, este texto é substituído."
                            className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
                        >
                            editado
                        </span>
                    )}
                </span>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="text-gray-400">
                        {draft.length} caracteres
                    </span>
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={disabled}
                        className="font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                        {copied ? 'Copiado ✓' : 'Copiar'}
                    </button>
                </div>
            </div>

            <textarea
                // Vários editores no mesmo modal (um por item): sem nome
                // acessível, um leitor de ecrã anuncia só "edit text".
                aria-label={label}
                value={draft}
                onChange={(e) => {
                    setDraft(e.target.value);
                    setSavedAt(null);
                }}
                disabled={disabled || isSaving}
                rows={12}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-gray-800 focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
            />

            {isDirty && !isSaving && (
                <p className="mt-1.5 text-xs text-amber-600">
                    Alterações por guardar. A geração usa o prompt guardado, não
                    o que está a escrever.
                </p>
            )}
            {!isDirty && savedAt && (
                <p className="mt-1.5 text-xs text-green-600">
                    Guardado às {savedAt.toLocaleTimeString('pt-PT')}
                </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isDirty || isSaving || disabled}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isSaving ? 'A guardar…' : 'Guardar prompt'}
                </button>

                {isDirty && (
                    <button
                        type="button"
                        onClick={handleDiscard}
                        disabled={isSaving}
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                    >
                        Descartar alterações
                    </button>
                )}

                {onGenerate && (
                    <button
                        type="button"
                        onClick={onGenerate}
                        disabled={!canGenerate || isGenerating || disabled}
                        title={
                            isDirty
                                ? 'Guarda o prompt antes de gerar.'
                                : undefined
                        }
                        className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {isGenerating
                            ? 'A gerar…'
                            : (generateLabel ?? 'Gerar a partir deste prompt')}
                    </button>
                )}
            </div>
        </div>
    );
}
