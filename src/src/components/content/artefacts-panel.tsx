import { ArtefactLightbox } from '@/components/content/artefact-lightbox';
import {
    assetKind,
    assetService,
    createFromFiles,
    isSafeExternalUrl,
    sniffMimeType,
} from '@/services/content-asset.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { AssetTargetType, ContentAsset } from '@/types/database';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ArtefactsPanelProps {
    targetType: AssetTargetType;
    targetId: string;
    /** Título da secção. */
    title?: string;
    /**
     * Disparado depois de um create (ficheiros ou link externo) ou de um
     * delete bem-sucedidos — nunca numa falha e nunca quando o update
     * otimista reverte. Serve para o painel irmão da página de detalhe
     * recarregar, porque cada instância tem o seu próprio estado.
     */
    onChanged?: () => void;
    /**
     * Quando muda, o painel volta a carregar do servidor. É o par de
     * `onChanged`: o modal de edição incrementa o valor na página e este
     * painel mostra o artefacto sem esperar por um recarregamento.
     */
    reloadKey?: number;
}

/** `details` são as linhas por ficheiro (um erro por ficheiro recusado). */
type Feedback = { ok: boolean; text: string; details?: string[] } | null;

function FileIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
        </svg>
    );
}

function PlayIcon({ className }: { className?: string }) {
    return (
        <span
            className={`flex items-center justify-center rounded-full bg-black/60 ${className ?? ''}`}
        >
            <svg
                className="h-4 w-4 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path d="M8 5v14l11-7z" />
            </svg>
        </span>
    );
}

/**
 * Área de artefactos de uma entidade (artigo, peça ou roteiro).
 *
 * Carrega os seus próprios dados a partir de (workspaceId, targetType,
 * targetId), por isso o mesmo painel serve os modais e as páginas de detalhe.
 * Suporta vários ficheiros de uma vez (multi-select ou arrastar) e links
 * externos.
 */
export function ArtefactsPanel({
    targetType,
    targetId,
    title = 'Artefactos',
    onChanged,
    reloadKey = 0,
}: ArtefactsPanelProps) {
    // Selector simples: o `useWorkspace()` pesado (fetch da lista de
    // workspaces, efeito de navegação, hidratação de providers de IA) é
    // demais para ler um único id — as páginas usam o mesmo selector.
    const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?.id ?? '');

    const [assets, setAssets] = useState<ContentAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [feedback, setFeedback] = useState<Feedback>(null);

    const [externalUrl, setExternalUrl] = useState('');
    const [externalName, setExternalName] = useState('');
    const [isSavingLink, setIsSavingLink] = useState(false);

    const [lightbox, setLightbox] = useState<ContentAsset | null>(null);

    /**
     * `onClose` estável: o `ArtefactLightbox` tem o `onClose` no array de deps do
     * efeito de teclado, por isso uma arrow function inline re-adicionava o
     * listener `keydown` em cada render do painel.
     */
    const closeLightbox = useCallback(() => setLightbox(null), []);

    // Contador de dropzones para ignorar o dragleave dos filhos: sem isto o
    // highlight pisca quando o cursor passa por cima de uma miniatura.
    const dragDepth = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        if (!workspaceId || !targetId) {
            // Sem workspace não há query a fazer. Sem isto o painel ficava
            // preso em "A carregar…" para sempre.
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setLoadError(null);
        try {
            const rows = await assetService.getAssets(
                workspaceId,
                targetType,
                targetId
            );
            setAssets(rows);
        } catch (err) {
            setLoadError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar artefactos'
            );
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, targetType, targetId]);

    useEffect(() => {
        void load();
        // `reloadKey` entra só para forçar o recarregamento quando a página
        // o incrementa (o `load` em si não depende dele — `load` também é
        // usado no botão "Tentar novamente", que não quer o valor).
    }, [load, reloadKey]);

    const handleFiles = async (files: File[]) => {
        if (files.length === 0) return;

        setIsUploading(true);
        setFeedback(null);

        try {
            // `createFromFiles` trata do limite por carregamento, da validação,
            // do upload paralelo e da inserção: um ficheiro recusado não leva
            // os restantes atrás e cada erro volta com o nome do ficheiro.
            const { created, errors } = await createFromFiles(
                workspaceId,
                targetType,
                targetId,
                files
            );

            // `created` sai em createdAt DESC, que é a ordem do carregamento
            // (Decisão 25): o mais recente fica no topo.
            if (created.length > 0) {
                setAssets((prev) => [...created, ...prev]);
                // Só quando entrou pelo menos um ficheiro, e nunca no `catch`:
                // o painel irmão só recarrega por uma criação real.
                onChanged?.();
            }

            if (errors.length > 0) {
                // Recusas e excesso de ficheiros chegam juntos em `errors`
                // (o limite é uma das entradas), por isso as duas mensagens
                // aparecem em conjunto em vez de uma tapar a outra.
                setFeedback({
                    ok: false,
                    text:
                        created.length > 0
                            ? `${created.length} carregados, ${errors.length} com problema:`
                            : 'Nenhum ficheiro foi carregado:',
                    details: errors.map((e) => `${e.name}: ${e.message}`),
                });
            } else {
                setFeedback({
                    ok: true,
                    text:
                        created.length === 1
                            ? 'Artefacto carregado.'
                            : `${created.length} artefactos carregados.`,
                });
            }
        } catch (err) {
            setFeedback({
                ok: false,
                text:
                    err instanceof Error
                        ? err.message
                        : 'Erro ao carregar artefactos',
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = async (asset: ContentAsset) => {
        setFeedback(null);
        // optimistic update: o artefacto desaparece já, reverte se falhar
        const previous = assets;
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));

        try {
            await assetService.deleteAsset(workspaceId, asset.id);
            // Depois do `await` e fora do `catch`: se o delete falhou há
            // reversão do update otimista e nada mudou para o outro painel.
            onChanged?.();
        } catch (err) {
            setAssets(previous);
            setFeedback({
                ok: false,
                text:
                    err instanceof Error
                        ? err.message
                        : 'Erro ao remover artefacto',
            });
        }
    };

    const handleExternalLink = async () => {
        const url = externalUrl.trim();
        if (!url) return;

        if (!isSafeExternalUrl(url)) {
            setFeedback({
                ok: false,
                text: 'Link inválido. Só são aceites endereços http ou https.',
            });
            return;
        }

        setIsSavingLink(true);
        setFeedback(null);
        try {
            const created = await assetService.createAsset({
                workspaceId,
                targetType,
                targetId,
                url,
                name: externalName.trim() || null,
                mimeType: sniffMimeType(url),
            });
            setAssets((prev) => [created, ...prev]);
            setExternalUrl('');
            setExternalName('');
            setFeedback({ ok: true, text: 'Link do artefacto guardado.' });
            // Um link externo é um create como os restantes.
            onChanged?.();
        } catch (err) {
            setFeedback({
                ok: false,
                text:
                    err instanceof Error
                        ? err.message
                        : 'Erro ao guardar link',
            });
        } finally {
            setIsSavingLink(false);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        dragDepth.current += 1;
        if (filesFromDrag(e).length > 0) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        dragDepth.current = 0;
        setIsDragging(false);
        void handleFiles(filesFromDrag(e));
    };

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900">
                    {title}
                    {assets.length > 0 && (
                        <span className="ml-1.5 font-normal text-gray-500">
                            ({assets.length})
                        </span>
                    )}
                </h4>
            </div>

            {/* Grelha de miniaturas (2 colunas na barra lateral de 30%) */}
            {isLoading ? (
                <p className="mb-2 text-xs text-gray-500">A carregar…</p>
            ) : loadError ? (
                <div className="mb-2">
                    <p className="text-xs text-red-600">{loadError}</p>
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="mt-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                        Tentar novamente
                    </button>
                </div>
            ) : assets.length === 0 ? (
                <p className="mb-2 text-xs text-gray-500">
                    Sem artefactos guardados.
                </p>
            ) : (
                <ul className="mb-3 grid grid-cols-2 gap-2">
                    {assets.map((asset) => {
                        const kind = assetKind(asset.mimeType);

                        return (
                            <li
                                key={asset.id}
                                className="group relative overflow-hidden rounded-md border border-gray-200 bg-white"
                            >
                                <button
                                    type="button"
                                    onClick={() => setLightbox(asset)}
                                    className="block w-full text-left"
                                    title={asset.name || asset.url}
                                >
                                    {/* O texto vive DENTRO do botão: como
                                        irmão, um leitor de ecrã anunciava-o
                                        como texto solto. Vale para todos os
                                        tipos — até o ficheiro genérico abre o
                                        mesmo lightbox. */}
                                    <span className="sr-only">
                                        Abrir em tela cheia
                                    </span>
                                    {kind === 'image' ? (
                                        <img
                                            src={asset.url}
                                            alt={
                                                asset.name || 'Artefacto'
                                            }
                                            loading="lazy"
                                            className="aspect-square w-full object-cover"
                                        />
                                    ) : kind === 'video' ? (
                                        <span className="relative block aspect-square w-full bg-gray-900">
                                            <video
                                                src={asset.url}
                                                preload="metadata"
                                                muted
                                                className="h-full w-full object-cover"
                                            />
                                            <PlayIcon className="absolute inset-0 m-auto h-8 w-8" />
                                        </span>
                                    ) : (
                                        <span className="flex aspect-square w-full flex-col items-center justify-center gap-1 bg-gray-50 px-2 text-center">
                                            <FileIcon className="h-6 w-6 text-gray-400" />
                                            <span className="line-clamp-2 text-[10px] leading-tight text-gray-600">
                                                {asset.name ||
                                                    'Ficheiro'}
                                            </span>
                                        </span>
                                    )}
                                </button>

                                <p className="truncate px-1.5 py-1 text-[10px] text-gray-500">
                                    {asset.name || 'Sem nome'}
                                </p>

                                <div className="absolute right-1 top-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleRemove(asset)
                                        }
                                        className="rounded bg-white/95 p-1 text-red-600 shadow-sm hover:bg-red-50"
                                        title="Remover"
                                    >
                                        <svg
                                            className="h-3.5 w-3.5"
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
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Zona de carregamento: clique para escolher ou arrastar */}
            <div
                onDragEnter={handleDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-md border-2 border-dashed px-3 py-3 text-center transition-colors ${
                    isDragging
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-300 bg-gray-50'
                }`}
            >
                <p className="mb-2 text-xs text-gray-500">
                    {isDragging
                        ? 'Larga os ficheiros aqui'
                        : 'Arrasta ficheiros aqui ou escolhe-os'}
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    disabled={isUploading}
                    onChange={(e) => {
                        void handleFiles(Array.from(e.target.files ?? []));
                        // reset para permitir escolher o mesmo ficheiro outra vez
                        e.target.value = '';
                    }}
                    className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-1.5 text-[10px] text-gray-400">
                    Imagens, vídeos ou PDF (até 25 MB cada, 10 por carregamento).
                    {isUploading && ' A carregar…'}
                </p>
            </div>

            {/* Link externo */}
            <div className="mt-2 space-y-2">
                <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="ou cola um link externo do artefacto"
                    className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={externalName}
                        onChange={(e) => setExternalName(e.target.value)}
                        placeholder="Nome (opcional)"
                        className="min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => void handleExternalLink()}
                        disabled={isSavingLink || !externalUrl.trim()}
                        className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        Guardar
                    </button>
                </div>
            </div>

            {feedback && (
                <div className="mt-1.5">
                    <p
                        className={`text-xs ${
                            feedback.ok ? 'text-green-600' : 'text-red-600'
                        }`}
                    >
                        {feedback.text}
                    </p>
                    {feedback.details && feedback.details.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                            {feedback.details.map((line, i) => (
                                <li key={`${i}-${line}`} className="break-words">
                                    {line}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <ArtefactLightbox
                isOpen={lightbox !== null}
                url={lightbox?.url ?? null}
                name={lightbox?.name ?? null}
                mimeType={lightbox?.mimeType ?? null}
                onClose={closeLightbox}
            />
        </div>
    );
}

/** Ficheiros de um evento de drag, ignorando pastas e texto arrastado. */
function filesFromDrag(e: React.DragEvent): File[] {
    const items = e.dataTransfer?.items;
    if (items) {
        return Array.from(items)
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);
    }

    const files = e.dataTransfer?.files;
    return files ? Array.from(files) : [];
}