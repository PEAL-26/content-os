import { ChannelBadge } from '@/components/channels/channel-badge';
import { PiecePreview } from '@/components/content/piece-preview';
import { workspacePath } from '@/lib/workspace-paths';
import type { ContentPieceWithRelations } from '@/types/database';
import {
    CONTENT_FORMAT_ICONS,
    CONTENT_FORMAT_LABELS,
    CONTENT_PIECE_STATUS_COLORS,
    CONTENT_PIECE_STATUS_LABELS,
} from '@/types/database';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface ContentPieceCardProps {
    piece: ContentPieceWithRelations;
    onApprove?: () => void;
    onRegenerate?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    /** Abre a página de detalhe da peça (clique no card). */
    onOpen?: () => void;
    isApproving?: boolean;
    isRegenerating?: boolean;
}

function Spinner({ className }: { className?: string }) {
    return (
        <svg
            className={`animate-spin ${className ?? 'h-3 w-3'}`}
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
    );
}

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className ?? 'h-3 w-3'}
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
    );
}

/**
 * Card de peça na listagem. O clique no corpo do card abre o detalhe (`onOpen`);
 * os botões de acção usam stopPropagation para não disparar a navegação.
 */
export function ContentPieceCard({
    piece,
    onApprove,
    onRegenerate,
    onEdit,
    onDelete,
    onOpen,
    isApproving = false,
    isRegenerating = false,
}: ContentPieceCardProps) {
    const statusColors = CONTENT_PIECE_STATUS_COLORS[piece.status];
    const isDraft = piece.status === 'DRAFT';
    const hasContent = Boolean(piece.body && piece.body.trim());
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState<string | null>(null);

    /** Copia a peça para a área de transferência (mesmo texto do detalhe). */
    const handleCopy = async () => {
        const text = [piece.title, piece.body, piece.hookText, piece.ctaText]
            .filter((part) => part && part.trim())
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
                          // Os botões de acção vivem dentro do wrapper e o
                          // keydown borbulha: sem este guard, Enter em
                          // "Aprovar" também navegava para o detalhe e a
                          // aprovação nunca chegava a acontecer.
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
            className={`group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md ${
                onOpen ? 'cursor-pointer' : ''
            }`}
        >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg">
                        {CONTENT_FORMAT_ICONS[piece.format]}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                        {CONTENT_FORMAT_LABELS[piece.format]}
                    </span>
                    {piece.channel && (
                        <ChannelBadge
                            channel={piece.channel.channel}
                            size="sm"
                        />
                    )}
                </div>
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                >
                    {CONTENT_PIECE_STATUS_LABELS[piece.status]}
                </span>
            </div>

            <div className="p-4">
                <PiecePreview piece={piece} compact />
            </div>

            {piece.article && (
                <div className="border-t border-gray-100 px-4 py-2">
                    {/* `stopPropagation` para o clique no link não abrir também
                        o detalhe da peça (o wrapper do card navega). */}
                    <Link
                        to={workspacePath(
                            piece.workspaceId,
                            `articles/${piece.article.id}/edit`
                        )}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate text-xs text-blue-600 hover:underline"
                        title={`Ver artigo de origem: ${piece.article.title}`}
                    >
                        Artigo: {piece.article.title}
                    </Link>
                </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2">
                <div className="flex items-center gap-2">
                    {isDraft && hasContent && onApprove && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onApprove();
                            }}
                            disabled={isApproving}
                            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                            {isApproving ? (
                                <Spinner />
                            ) : (
                                <CheckIcon />
                            )}
                            Aprovar
                        </button>
                    )}
                    {onRegenerate && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRegenerate();
                            }}
                            disabled={isRegenerating}
                            className="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-white px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                        >
                            {isRegenerating ? (
                                <Spinner />
                            ) : (
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
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                            )}
                            Regenerar
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleCopy();
                        }}
                        disabled={!hasContent}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                        title="Copiar conteúdo"
                    >
                        {copied ? (
                            <CheckIcon className="h-4 w-4 text-green-600" />
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
                                    d="M8 4h10a2 2 0 012 2v10a2 2 0 01-2 2h-4M4 8h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V10a2 2 0 012-2z"
                                />
                            </svg>
                        )}
                    </button>
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Editar"
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
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.828 2.828 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                            </svg>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar"
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
                    )}
                </div>
            </div>

            {/* O erro de clipboard fica no próprio card (o da listagem não tem
                slot de erro); o mesmo texto da página de detalhe. */}
            {copyError && (
                <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                    {copyError}
                </p>
            )}
        </div>
    );
}