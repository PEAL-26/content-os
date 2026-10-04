import { ArtefactsPanel } from '@/components/content/artefacts-panel';
import { ContentPromptsPanel } from '@/components/content/content-prompts-panel';
import { PublicationsPanel } from '@/components/content/publications-panel';
import { Modal } from '@/components/ui/modal';
import type { VideoScriptWithRelations } from '@/services/video-script.service';
import {
    ALL_CHANNELS,
    CHANNEL_LABELS,
    CONTENT_FORMAT_LABELS,
    type SocialChannel,
} from '@/types/database';
import { useEffect, useState } from 'react';

/** Limites da duração alvo, usados no clamp (o input também os declara). */
const DURATION_MIN = 5;
const DURATION_MAX = 600;

function clampDuration(value: number): number {
    if (!Number.isFinite(value)) return DURATION_MIN;
    return Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(value)));
}

/** Sequência de ids de linha — nunca reutilizada, mesmo entre modais. */
let rowIdSeq = 0;

function newRowId(): string {
    rowIdSeq += 1;
    return `linha-${rowIdSeq}`;
}

interface VideoScriptModalProps {
    isOpen: boolean;
    onClose: () => void;
    script: VideoScriptWithRelations | null;
    onSave: (data: {
        title: string;
        hook: string;
        problem: string | null;
        solution: string | null;
        cta: string;
        fullScript: string;
        durationSec: number;
        targetChannel: SocialChannel;
        onScreenText: string[];
        bRoll: string[];
    }) => Promise<void>;
    /** Reescreve o prompt do roteiro com IA. */
    onRewritePrompt?: () => void;
    isRewritingPrompt?: boolean;
    isSaving?: boolean;
    /**
     * Encaminhado para o `ContentPromptsPanel`: o job VIDEO_SCRIPT escreve o
     * prompt mas não é seguido pelo painel, por isso a página passa aqui o
     * momento em que o prompt mudou.
     */
    promptsReloadKey?: number;
    /**
     * Encaminhado para o `ArtefactsPanel` e para o `PublicationsPanel` do
     * modal: a página de detalhe recarrega o painel da barra lateral quando
     * um artefacto ou uma publicação muda aqui. Os dois painéis vivem em
     * instâncias diferentes com estado próprio e, na página, partilham o
     * mesmo `reloadKey` — por isso um único callback chega.
     */
    onAssetsChanged?: () => void;
}

/**
 * Editor de uma lista de strings (texto para ecrã, sugestões de B-roll).
 *
 * Antes estes campos eram checkboxes decorativos no card — sem `state`, sem
 * `onChange`, perdiam-se a cada re-render e nunca eram gravados. Aqui são
 * linhas de texto editáveis.
 *
 * Cada linha tem um id estável (`rowIds`), não o índice: com `key={index}`,
 * apagar uma linha do meio fazia o React reaproveitar o input seguinte e o
 * cursor saltava para outra linha.
 */
function StringListField({
    id,
    label,
    hint,
    values,
    onChange,
}: {
    /** Base dos ids dos inputs, para o `<label>` apontar para o primeiro. */
    id: string;
    label: string;
    hint?: string;
    values: string[];
    onChange: (next: string[]) => void;
}) {
    const [rowCount, setRowCount] = useState(values.length);
    const [rowIds, setRowIds] = useState<string[]>(() =>
        Array.from({ length: values.length }, newRowId)
    );

    // Ajustar o estado durante o render (o padrão do React para "as props
    // mudaram") e não num efeito: os ids ficam certainos no primeiro render
    // com o novo número de linhas, sem um render intermédio.
    if (values.length !== rowCount) {
        setRowCount(values.length);
        setRowIds((prev) =>
            values.length > prev.length
                ? [
                      ...prev,
                      ...Array.from(
                          { length: values.length - prev.length },
                          newRowId
                      ),
                  ]
                : prev.slice(0, values.length)
        );
    }

    return (
        <div>
            <label
                htmlFor={`${id}-0`}
                className="mb-1.5 block text-sm font-medium text-gray-700"
            >
                {label}
            </label>
            <div className="space-y-2">
                {values.map((value, index) => (
                    <div
                        key={rowIds[index]}
                        className="flex items-center gap-2"
                    >
                        <input
                            id={`${id}-${index}`}
                            type="text"
                            value={value}
                            onChange={(e) => {
                                const next = [...values];
                                next[index] = e.target.value;
                                onChange(next);
                            }}
                            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() =>
                                onChange(values.filter((_, i) => i !== index))
                            }
                            className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Remover linha"
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
                <button
                    type="button"
                    onClick={() => onChange([...values, ''])}
                    className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700"
                >
                    + Adicionar linha
                </button>
            </div>
            {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
        </div>
    );
}

/**
 * Modal de edição de roteiro de vídeo.
 *
 * Não existia um modal para isto: o único `updateScript` na página dos roteiros
 * vinha do `onAssetChange`, ou seja, não havia forma de corrigir um roteiro
 * gerado — só de o regenerar.
 */
export function VideoScriptModal({
    isOpen,
    onClose,
    script,
    onSave,
    onRewritePrompt,
    isRewritingPrompt = false,
    isSaving = false,
    promptsReloadKey,
    onAssetsChanged,
}: VideoScriptModalProps) {
    const [title, setTitle] = useState('');
    const [hook, setHook] = useState('');
    const [problem, setProblem] = useState('');
    const [solution, setSolution] = useState('');
    const [cta, setCta] = useState('');
    const [fullScript, setFullScript] = useState('');
    const [durationSec, setDurationSec] = useState(60);
    const [targetChannel, setTargetChannel] = useState<SocialChannel>(
        'INSTAGRAM'
    );
    const [onScreenText, setOnScreenText] = useState<string[]>([]);
    const [bRoll, setBRoll] = useState<string[]>([]);

    useEffect(() => {
        if (!script) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle(script.title || '');

        setHook(script.hook || '');

        setProblem(script.problem || '');

        setSolution(script.solution || '');

        setCta(script.cta || '');

        setFullScript(script.fullScript || '');

        setDurationSec(script.durationSec ?? 60);

        setTargetChannel(script.targetChannel ?? 'INSTAGRAM');

        setOnScreenText(script.onScreenText || []);

        setBRoll(script.bRoll || []);
    }, [script]);

    useEffect(() => {
        if (isOpen) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle('');

        setHook('');

        setProblem('');

        setSolution('');

        setCta('');

        setFullScript('');

        setDurationSec(60);

        setTargetChannel('INSTAGRAM');

        setOnScreenText([]);

        setBRoll([]);
    }, [isOpen]);

    const handleSave = async () => {
        await onSave({
            title: title.trim(),
            hook,
            problem: problem.trim() || null,
            solution: solution.trim() || null,
            cta,
            fullScript,
            durationSec: clampDuration(durationSec),
            targetChannel,
            // Linhas vazias deixadas por remover não são gravadas.
            onScreenText: onScreenText.map((t) => t.trim()).filter(Boolean),
            bRoll: bRoll.map((b) => b.trim()).filter(Boolean),
        });
    };

    if (!script) return null;

    const canSave =
        title.trim().length > 0 &&
        hook.trim().length > 0 &&
        cta.trim().length > 0 &&
        fullScript.trim().length > 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Editar: ${CONTENT_FORMAT_LABELS.VIDEO_SCRIPT}`}
            size="lg"
        >
            <div className="space-y-4">
                <div>
                    <label
                        htmlFor="roteiro-titulo"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Título
                    </label>
                    <input
                        id="roteiro-titulo"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label
                        htmlFor="roteiro-hook"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Hook (3s)
                    </label>
                    <input
                        id="roteiro-hook"
                        type="text"
                        value={hook}
                        onChange={(e) => setHook(e.target.value)}
                        placeholder="Primeiros 3 segundos (gancho visual/verbal)"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label
                        htmlFor="roteiro-problema"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Problema
                    </label>
                    <textarea
                        id="roteiro-problema"
                        value={problem}
                        onChange={(e) => setProblem(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label
                        htmlFor="roteiro-solucao"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Solução
                    </label>
                    <textarea
                        id="roteiro-solucao"
                        value={solution}
                        onChange={(e) => setSolution(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label
                        htmlFor="roteiro-completo"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        Roteiro completo
                    </label>
                    <textarea
                        id="roteiro-completo"
                        value={fullScript}
                        onChange={(e) => setFullScript(e.target.value)}
                        rows={8}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label
                        htmlFor="roteiro-cta"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        CTA (Call to Action)
                    </label>
                    <input
                        id="roteiro-cta"
                        type="text"
                        value={cta}
                        onChange={(e) => setCta(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label
                            htmlFor="roteiro-duracao"
                            className="mb-1.5 block text-sm font-medium text-gray-700"
                        >
                            Duração alvo (segundos)
                        </label>
                        <input
                            id="roteiro-duracao"
                            type="number"
                            min={DURATION_MIN}
                            max={DURATION_MAX}
                            value={durationSec}
                            onChange={(e) => {
                                // `''` enquanto se apaga o campo: manter o
                                // último valor válido. O antigo
                                // `Number(v) || 60` fazia o `0` saltar para 60
                                // e o `min`/`max` só eram decorativos.
                                if (e.target.value === '') return;
                                setDurationSec(
                                    clampDuration(Number(e.target.value))
                                );
                            }}
                            onBlur={() =>
                                setDurationSec((d) => clampDuration(d))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="roteiro-canal"
                            className="mb-1.5 block text-sm font-medium text-gray-700"
                        >
                            Canal alvo
                        </label>
                        <select
                            id="roteiro-canal"
                            value={targetChannel}
                            onChange={(e) =>
                                setTargetChannel(
                                    e.target.value as SocialChannel
                                )
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            {ALL_CHANNELS.map((channel) => (
                                <option key={channel} value={channel}>
                                    {CHANNEL_LABELS[channel]}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <StringListField
                    id="roteiro-texto-ecra"
                    label="Texto para ecrã"
                    hint="Uma linha por texto que aparece no vídeo."
                    values={onScreenText}
                    onChange={setOnScreenText}
                />

                <StringListField
                    id="roteiro-broll"
                    label="Sugestões de B-roll"
                    hint="Uma linha por cena de apoio."
                    values={bRoll}
                    onChange={setBRoll}
                />
            </div>

            <div className="mt-6 space-y-5 border-t border-gray-200 pt-4">
                <ArtefactsPanel
                    targetType="VIDEO_SCRIPT"
                    targetId={script.id}
                    onChanged={onAssetsChanged}
                />
                <PublicationsPanel
                    targetType="VIDEO_SCRIPT"
                    targetId={script.id}
                    onChanged={onAssetsChanged}
                />
            </div>

            <div className="mt-5 border-t border-gray-200 pt-4">
                <ContentPromptsPanel
                    targetType="VIDEO_SCRIPT"
                    targetId={script.id}
                    onRewritePrompt={onRewritePrompt}
                    isRewritingPrompt={isRewritingPrompt}
                    reloadKey={promptsReloadKey}
                />
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button
                    onClick={onClose}
                    disabled={isSaving}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={() => void handleSave()}
                    disabled={isSaving || !canSave}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    title={
                        canSave
                            ? undefined
                            : 'Preenche título, hook, CTA e roteiro completo'
                    }
                >
                    {isSaving ? 'A guardar...' : 'Guardar'}
                </button>
            </div>
        </Modal>
    );
}