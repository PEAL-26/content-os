import {
    assetKind,
    isSafeExternalUrl,
} from '@/services/content-asset.service';
import { useEffect } from 'react';

interface ArtefactLightboxProps {
    isOpen: boolean;
    url: string | null;
    name: string | null;
    mimeType: string | null;
    onClose: () => void;
}

function fileExtension(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    const segment = path.split('/').pop() ?? '';
    const dot = segment.lastIndexOf('.');
    return dot > 0 ? segment.slice(dot + 1).toUpperCase() : '';
}

/**
 * Modal em tela cheia para ver um artefacto.
 *
 * Imagens abrem como <img>, vídeos como <video controls>, e o resto como link
 * de download — não há nada a pré-visualizar.
 */
export function ArtefactLightbox({
    isOpen,
    url,
    name,
    mimeType,
    onClose,
}: ArtefactLightboxProps) {
    // Escape fecha. O listener só existe enquanto o modal está aberto.
    useEffect(() => {
        if (!isOpen) return;

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !url) return null;

    const kind = assetKind(mimeType);
    const title = name || url;

    /**
     * Defesa em profundidade no caminho de renderização: a inserção de links
     * externos valida o esquema, mas as linhas vindas do backfill da coluna
     * `assetUrl` nunca passaram por essa validação. Um `javascript:` num
     * `href` é executado ao clicar, por isso o link só é desenhado se for
     * http(s).
     *
     * `<img src>` / `<video src>` não executam `javascript:` (o browser
     * simplesmente não carrega) — daí ficarem sem validação.
     */
    const canOpen = isSafeExternalUrl(url);

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col bg-black/90"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={onClose}
        >
            <div
                className="flex shrink-0 items-center justify-between gap-4 px-4 py-3"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                        {title}
                    </p>
                    {mimeType && (
                        <p className="truncate text-xs text-gray-400">
                            {mimeType}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {canOpen ? (
                        <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800"
                        >
                            Abrir
                        </a>
                    ) : (
                        <span className="text-[10px] text-gray-500">
                            Link não seguro — não pode ser aberto.
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
                        title="Fechar"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <div
                className="flex min-h-0 flex-1 items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
            >
                {kind === 'image' ? (
                    <img
                        src={url}
                        alt={title}
                        className="max-h-full max-w-full rounded object-contain"
                    />
                ) : kind === 'video' ? (
                    <video
                        src={url}
                        controls
                        autoPlay
                        className="max-h-full max-w-full rounded"
                    >
                        O teu navegador não suporta vídeo.
                    </video>
                ) : (
                    <div className="rounded-lg bg-gray-900 px-6 py-8 text-center">
                        <p className="mb-3 text-sm text-gray-300">
                            Não há pré-visualização para este tipo de ficheiro
                            {fileExtension(url) && ` (${fileExtension(url)})`}.
                        </p>
                        {canOpen ? (
                            <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                                Abrir o ficheiro
                            </a>
                        ) : (
                            <p className="text-sm text-red-400">
                                O endereço deste artefacto não é http(s) e foi
                                bloqueado.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}