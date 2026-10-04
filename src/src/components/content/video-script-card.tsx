import { ChannelBadge } from '@/components/channels/channel-badge';
import type { VideoScriptWithRelations } from '@/services/video-script.service';
import {
    calculateReadingTime,
    calculateDurationFromScript,
    isDurationExceeded,
} from '@/lib/ai';
import { workspacePath } from '@/lib/workspace-paths';
import { ARTICLE_STATUS_COLORS, ARTICLE_STATUS_LABELS } from '@/types/database';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface VideoScriptCardProps {
    script: VideoScriptWithRelations;
    onApprove?: () => void;
    onDelete?: () => void;
    /** Abre a página de detalhe do roteiro (clique no card). */
    onOpen?: () => void;
    isApproving?: boolean;
    /** Estado de geração em segundo plano deste roteiro. */
    generation?: {
        status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
        error: string | null;
    } | null;
    onRetryGeneration?: () => void;
}

/**
 * Card de roteiro na listagem.
 *
 * Antes era um acordeão: o clique no header expandia o roteiro, os artefactos e
 * as publicações inline. Como o card passou a navegar para a página de detalhe,
 * o conteúdo completo (blocos do roteiro, artefactos, publicações, acções)
 * passou para lá, e aqui ficam só o resumo e as acções rápidas.
 */
export function VideoScriptCard({
    script,
    onApprove,
    onDelete,
    onOpen,
    isApproving = false,
    generation = null,
    onRetryGeneration,
}: VideoScriptCardProps) {
    const isDraft = script.status === 'DRAFT';
    const statusLabel = ARTICLE_STATUS_LABELS[script.status];
    const statusColor = ARTICLE_STATUS_COLORS[script.status];
    const scriptText = script.fullScript || '';
    const estimatedDuration = calculateReadingTime(scriptText);
    const durationExceeded = isDurationExceeded(scriptText, script.durationSec);
    const actualDuration = calculateDurationFromScript(scriptText);
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState<string | null>(null);

    /** Copia o roteiro para a área de transferência (mesmo texto do detalhe). */
    const handleCopy = async () => {
        const text = [
            script.hook,
            script.problem,
            script.solution,
            script.fullScript,
            script.cta,
        ]
            .filter(Boolean)
            .join('\n\n');
        if (!text) return;

        setCopyError(null);
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // `navigator.clipboard` não existe em contextos não seguros
            // (http://localhost em rede, iframe sem permissão): sem este catch o
            // utilizador não recebe qualquer feedback.
            setCopyError(
                'Não foi possível copiar. O browser não deu acesso à área de transferência.'
            );
        }
    };

    return (
        <div
            onClick={onOpen}
            onKeyDown={
                onOpen
                    ? (e) => {
                          // "Aprovar", "Eliminar" e "Tentar novamente" são
                          // descendentes do wrapper: sem este guard o Enter
                          // também disparava a navegação do card.
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpen();
                          }
                      }
                    : undefined
            }
            role={onOpen ? 'button' : undefined}
            tabIndex={onOpen ? 0 : undefined}
            className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md ${
                onOpen ? 'cursor-pointer' : ''
            }`}
        >
            <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="text-xl">🎬</span>
                    <div className="min-w-0">
                        <h3 className="truncate font-medium text-gray-900">
                            {script.title}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <ChannelBadge
                                channel={script.targetChannel}
                                size="sm"
                            />
                            <span className="text-xs text-gray-500">
                                ~{estimatedDuration} min de leitura
                            </span>
                            <span className="text-xs text-gray-500">
                                ~{actualDuration}s de vídeo
                            </span>
                            {durationExceeded && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                                    Excede {script.durationSec}s
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                    >
                        {statusLabel}
                    </span>

                    {isDraft && onApprove && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onApprove();
                            }}
                            disabled={isApproving}
                            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                            {isApproving ? 'A aprovar…' : 'Aprovar'}
                        </button>
                    )}

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleCopy();
                        }}
                        disabled={!scriptText}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                    >
                        {copied ? 'Copiado!' : 'Copiar'}
                    </button>

                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                            Eliminar
                        </button>
                    )}
                </div>
            </div>

            {script.article && (
                <div className="border-t border-gray-100 px-4 py-2">
                    {/* `stopPropagation` para o clique no link não abrir também
                        o detalhe do roteiro (o wrapper do card navega). */}
                    <Link
                        to={workspacePath(
                            script.workspaceId,
                            `articles/${script.article.id}/edit`
                        )}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate text-xs text-blue-600 hover:underline"
                        title={`Ver artigo de origem: ${script.article.title}`}
                    >
                        Artigo: {script.article.title}
                    </Link>
                </div>
            )}

            {/* O erro de clipboard fica no próprio card (o da listagem não tem
                slot de erro); o mesmo texto da página de detalhe. */}
            {copyError && (
                <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                    {copyError}
                </p>
            )}

            {generation && generation.status !== 'COMPLETED' && (
                <div
                    className={
                        generation.status === 'FAILED'
                            ? 'border-b border-red-100 bg-red-50 px-4 py-2'
                            : 'border-b border-blue-100 bg-blue-50 px-4 py-2'
                    }
                >
                    {generation.status === 'FAILED' ? (
                        <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 text-xs text-red-700">
                                {generation.error ||
                                    'A geração deste roteiro falhou.'}
                            </p>
                            {onRetryGeneration && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRetryGeneration();
                                    }}
                                    className="shrink-0 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                                >
                                    Tentar novamente
                                </button>
                            )}
                        </div>
                    ) : (
                        <p className="flex items-center gap-2 text-xs text-blue-700">
                            <svg
                                className="h-3.5 w-3.5 animate-spin"
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
                            A gerar o roteiro em segundo plano…
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
