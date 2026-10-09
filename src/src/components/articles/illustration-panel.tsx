import { Copy, ImageIcon, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MediaPromptsPanel } from '@/components/media/media-prompts-panel';
import {
    buildArticleExport,
    illustrationMarkers,
} from '@/lib/ai/illustrations';
import { assetService } from '@/services/content-asset.service';
import type { ContentAsset } from '@/types/database';

// =============================================================================
// Painel de ILUSTRAÇÕES de um artigo.
//
// O artigo pode conter marcadores `[IMAGEM SUGERIDA — ...]` (ver
// `lib/ai/illustrations`). Cada marcador é uma ilustração que o utilizador
// pediu, com a descrição visual já escrita — e essa descrição é a semente do
// prompt de media, que aparece no `MediaPromptsPanel`.
//
// O botão "Copiar artigo" é o que fecha o ciclo: converte cada marcador no
// `![alt](url)` do ficheiro gerado e remove os que ficaram sem imagem, para o
// markdown poder ser colado directamente no blog.
// =============================================================================

export interface IllustrationPanelProps {
    workspaceId: string;
    articleId: string;
    /** O corpo do artigo, para extrair os marcadores e para o export. */
    body: string;
    /** Recarrega quando o corpo ou os artefactos mudam. */
    reloadKey?: number;
    onCopied?: () => void;
}

export function IllustrationPanel({
    workspaceId,
    articleId,
    body,
    reloadKey = 0,
    onCopied,
}: IllustrationPanelProps) {
    const markers = illustrationMarkers(body);
    const [assets, setAssets] = useState<ContentAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const loadAssets = useCallback(async () => {
        if (!workspaceId || !articleId) {
            // Sem workspace não há query a fazer. Sem isto o painel ficava
            // preso em "A carregar…" para sempre.
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            setAssets(
                await assetService.getAssets(workspaceId, 'ARTICLE', articleId)
            );
        } catch {
            // Os marcadores continuam úteis sem os artefactos — o prompt é o
            // que se copia.
            setAssets([]);
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, articleId]);

    useEffect(() => {
        void loadAssets();
    }, [loadAssets, reloadKey]);

    const handleCopyArticle = async () => {
        // Só os ficheiros PRONTOS entram no export: um artefacto "a gerar" não
        // tem URL, e um "falhou" não deve virar um `![]()` partido.
        const ready = assets
            .filter((asset) => asset.status === 'READY' && asset.url)
            .map((asset) => ({
                itemKey: asset.itemKey ?? 'main',
                url: asset.url,
                name: asset.name,
            }));

        const markdown = buildArticleExport(body, ready);
        try {
            await navigator.clipboard.writeText(markdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
            onCopied?.();
        } catch {
            // Clipboard bloqueado: o botão fica mudo, como em todo o projecto.
        }
    };

    if (isLoading) {
        return (
            <p className="py-2 text-xs text-gray-400">A carregar imagens…</p>
        );
    }

    if (markers.length === 0) {
        return (
            <p className="rounded bg-gray-50 px-2 py-1.5 text-xs text-gray-500">
                Este artigo não tem marcadores{' '}
                <code className="text-[10px]">[IMAGEM SUGERIDA — …]</code>.
                Escreve-os no corpo para o gerador criar a imagem a partir
                deles.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-xs font-medium text-gray-700">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {markers.length} ilustração
                    {markers.length === 1 ? '' : 'ões'} no artigo
                </span>
                <button
                    type="button"
                    onClick={handleCopyArticle}
                    className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-700"
                    title="Copiar o artigo com as imagens já geradas"
                >
                    <Copy className="h-3 w-3" />
                    Copiar artigo
                </button>
            </div>

            {copied && (
                <p className="text-[10px] text-green-700">
                    Artigo copiado com as imagens já no lugar.
                </p>
            )}

            <ol className="space-y-1.5">
                {markers.map((marker) => {
                    const asset = assets.find(
                        (a) => a.itemKey === marker.itemKey && a.status === 'READY'
                    );
                    return (
                        <li
                            key={marker.itemKey}
                            className="rounded border border-gray-200 bg-white p-2"
                        >
                            <p className="text-xs text-gray-800">
                                {marker.description}
                            </p>
                            {asset ? (
                                <a
                                    href={asset.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    Ver imagem
                                </a>
                            ) : (
                                <p className="mt-1 text-[10px] text-amber-700">
                                    Sem imagem gerada — o prompt acima dá para
                                    usar noutro sítio.
                                </p>
                            )}
                        </li>
                    );
                })}
            </ol>

            {/* Os prompts de media por marcador: é onde se edita e copia o
                prompt portátil, e onde se gera a imagem se houver modelo. */}
            <MediaPromptsPanel
                workspaceId={workspaceId}
                targetType="ARTICLE"
                targetId={articleId}
                labelsByItemKey={Object.fromEntries(
                    markers.map((m) => [m.itemKey, `Ilustração ${m.index}`])
                )}
            />
        </div>
    );
}