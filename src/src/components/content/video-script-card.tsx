import { ChannelBadge } from '@/components/channels/channel-badge';
import type { VideoScriptWithRelations } from '@/services/video-script.service';
import {
    calculateReadingTime,
    calculateDurationFromScript,
    isDurationExceeded,
} from '@/lib/ai';
import { useState } from 'react';

interface VideoScriptCardProps {
    script: VideoScriptWithRelations;
    onApprove?: () => void;
    onDelete?: () => void;
    onCopy?: () => void;
    isApproving?: boolean;
}

export function VideoScriptCard({
    script,
    onApprove,
    onDelete,
    onCopy,
    isApproving = false,
}: VideoScriptCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const isDraft = script.status === 'DRAFT';
    const scriptText = script.fullScript || '';
    const estimatedDuration = calculateReadingTime(scriptText);
    const durationExceeded = isDurationExceeded(scriptText, script.durationSec);
    const actualDuration = calculateDurationFromScript(scriptText);

    const handleCopyScript = async () => {
        const fullText = [
            script.hook,
            script.problem,
            script.solution,
            script.fullScript,
            script.cta,
        ]
            .filter(Boolean)
            .join('\n\n');

        await navigator.clipboard.writeText(fullText);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div
                className="flex cursor-pointer items-center justify-between bg-gray-50 px-4 py-3"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-xl">🎬</span>
                    <div>
                        <h3 className="font-medium text-gray-900">
                            {script.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <ChannelBadge
                                channel={script.targetChannel}
                                size="sm"
                            />
                            <span className="text-xs text-gray-500">
                                ~{estimatedDuration} min de leitura
                            </span>
                            {durationExceeded && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                                    Excede {script.durationSec}s
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            isDraft
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-green-100 text-green-700'
                        }`}
                    >
                        {isDraft ? 'Rascunho' : 'Aprovado'}
                    </span>
                    <svg
                        className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                </div>
            </div>

            {isExpanded && (
                <div className="border-t border-gray-200 p-4 space-y-4">
                    {script.article && (
                        <p className="text-xs text-gray-500">
                            Artigo: {script.article.title}
                        </p>
                    )}

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                HOOK (3s)
                            </label>
                            <p className="rounded bg-yellow-50 p-2 text-sm font-medium text-gray-900">
                                {script.hook}
                            </p>
                        </div>

                        {script.problem && (
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    PROBLEMA (~{Math.round(script.durationSec * 0.15)}s)
                                </label>
                                <p className="text-sm text-gray-700">
                                    {script.problem}
                                </p>
                            </div>
                        )}

                        {script.solution && (
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    SOLUÇÃO (~{Math.round(script.durationSec * 0.6)}s)
                                </label>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {script.solution}
                                </p>
                            </div>
                        )}

                        {script.fullScript && (
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    ROTEIRO COMPLETO (~{actualDuration}s)
                                </label>
                                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {script.fullScript}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                CTA
                            </label>
                            <p className="rounded bg-green-50 p-2 text-sm font-medium text-green-800">
                                {script.cta}
                            </p>
                        </div>

                        {script.onScreenText && script.onScreenText.length > 0 && (
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    TEXTO PARA ECRÃ
                                </label>
                                <div className="space-y-1">
                                    {script.onScreenText.map((text, i) => (
                                        <label
                                            key={i}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                            />
                                            <span className="text-gray-700">{text}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {script.bRoll && script.bRoll.length > 0 && (
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    SUGESTÕES B-ROLL
                                </label>
                                <div className="space-y-1">
                                    {script.bRoll.map((item, i) => (
                                        <label
                                            key={i}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                            />
                                            <span className="text-gray-700">{item}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCopyScript();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                        >
                            {copied ? (
                                <>
                                    <svg
                                        className="h-4 w-4 text-green-600"
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
                                    Copiado!
                                </>
                            ) : (
                                <>
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
                                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                        />
                                    </svg>
                                    Copiar roteiro
                                </>
                            )}
                        </button>

                        <div className="flex items-center gap-2">
                            {isDraft && onApprove && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onApprove();
                                    }}
                                    disabled={isApproving}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                    {isApproving ? (
                                        <svg
                                            className="h-4 w-4 animate-spin"
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
                                                d="M5 13l4 4L19 7"
                                            />
                                        </svg>
                                    )}
                                    Aprovar
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete();
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
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
                                    Eliminar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
