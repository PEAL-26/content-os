import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import {
    MEDIA_MODALITY_LABELS,
    type ContentMediaPrompt,
    type MediaModality,
} from '@/types/database';

// =============================================================================
// Cartão de um prompt de MEDIA.
//
// O requisito central desta peça é a PORTABILIDADE: o prompt tem de poder ser
// colado no Midjourney (ou em qualquer outro sitio) e dar o mesmo resultado.
// Por isso o cartão mostra, em separado e explicitamente:
//   · o prompt (sem nada de plataforma nem formato) — o que se copia;
//   · o `aspectRatio` e o `negativePrompt` — parâmetros que NÃO entram no prompt;
//   · que modelo escreveu o prompt.
// =============================================================================

export interface MediaPromptCardProps {
    prompt: ContentMediaPrompt;
    /** Rótulo legível ("Slide 3", "Cena 2", "Ilustração 1"). */
    label: string;
    modality: MediaModality;
    /** `true` quando o utilizador editou o prompt à mão. */
    isEdited: boolean;
    onSaveEdit?: (prompt: string) => Promise<void>;
}

export function MediaPromptCard({
    prompt,
    label,
    modality,
    isEdited,
    onSaveEdit,
}: MediaPromptCardProps) {
    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(prompt.prompt);
    const [saving, setSaving] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(prompt.prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard bloqueado (permissão/HTTP): o prompt está visível, o
            // utilizador pode seleccionar e copiar à mão.
        }
    };

    const handleSave = async () => {
        if (!onSaveEdit) return;
        setSaving(true);
        try {
            await onSaveEdit(draft);
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">
                        {label}
                    </span>
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                        {modality}
                    </span>
                    {isEdited && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                            editado por ti
                        </span>
                    )}
                    {prompt.editedAt && (
                        <span
                            className="text-[10px] text-gray-400"
                            title={`Editado em ${new Date(prompt.editedAt).toLocaleString()}`}
                        >
                            edit.
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handleCopy}
                        title="Copiar o prompt (sem plataforma nem formato)"
                        aria-label={`Copiar prompt de ${modality} para ${label}`}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                        {copied ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                            <Copy className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            </div>

            {editing ? (
                <div className="space-y-2">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={4}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || draft === prompt.prompt}
                            className="rounded bg-purple-600 px-2 py-1 text-xs text-white disabled:bg-gray-300"
                        >
                            {saving ? 'A guardar…' : 'Guardar'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDraft(prompt.prompt);
                                setEditing(false);
                            }}
                            className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : (
                <p
                    className="whitespace-pre-wrap rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-800"
                    onDoubleClick={
                        onSaveEdit ? () => setEditing(true) : undefined
                    }
                >
                    {prompt.prompt}
                </p>
            )}

            {/* Parâmetros que NÃO entram no prompt (Decisão 29) — mostrados à
                parte para que o utilizador saiba o que o prompt não diz. */}
            {(prompt.aspectRatio || prompt.negativePrompt) && (
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
                    {prompt.aspectRatio && (
                        <div className="flex gap-1">
                            <dt className="font-medium">Formato:</dt>
                            <dd>{prompt.aspectRatio}</dd>
                        </div>
                    )}
                    {prompt.negativePrompt && (
                        <div className="flex gap-1">
                            <dt className="font-medium">Evitar:</dt>
                            <dd className="truncate" title={prompt.negativePrompt}>
                                {prompt.negativePrompt}
                            </dd>
                        </div>
                    )}
                </dl>
            )}

            {/* Sem modelo a sério não há ficheiro — mas o prompt é portátil e é isso que
            o utilizador leva para outra ferramenta. O aviso diz as duas coisas,
            para ele não concluir que o trabalho se perdeu. */}
            <p className="mt-2 text-[10px] text-gray-400">
                Se não houver modelo activo para{' '}
                {MEDIA_MODALITY_LABELS[modality].toLowerCase()}, o prompt acima
                serve para gerares o ficheiro noutro sítio.
            </p>

            {prompt.modelCode && (
                <p className="mt-2 text-[10px] text-gray-400">
                    Escrito por {prompt.modelCode}
                </p>
            )}
        </div>
    );
}