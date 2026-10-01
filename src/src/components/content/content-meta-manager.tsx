import { promptItemLabel, usePiecePrompts } from '@/hooks/use-piece-prompts';
import { parseItemKeyOrder } from '@/lib/ai/generation-job-types';
import {
    publicationService,
    uploadAsset,
} from '@/services/publication.service';
import { PromptEditor } from '@/components/content/prompt-editor';
import type { ContentPublication } from '@/types/database';
import { useEffect, useState } from 'react';

interface ContentMetaManagerProps {
    targetType: 'PIECE' | 'VIDEO_SCRIPT' | 'ARTICLE';
    targetId: string;
    assetUrl?: string | null;
    assetName?: string | null;
    /** Grava o artefacto (URL + nome) na entidade. */
    onAssetChange?: (data: {
        assetUrl: string | null;
        assetName: string | null;
    }) => Promise<void>;
    /** Peça em foco — habilita "Gerar peça" / "Gerar este slide". */
    piece?: {
        id: string;
        format: string;
        body: string;
        slideCount?: number | null;
    };
    /** Reescreve o prompt da peça (meta-prompting). */
    onRewritePrompt?: () => void;
    isRewritingPrompt?: boolean;
}

const PLATFORM_OPTIONS = [
    { value: 'LINKEDIN', label: 'LinkedIn' },
    { value: 'INSTAGRAM', label: 'Instagram' },
    { value: 'TIKTOK', label: 'TikTok' },
    { value: 'YOUTUBE', label: 'YouTube' },
    { value: 'X_TWITTER', label: 'X (Twitter)' },
    { value: 'FACEBOOK', label: 'Facebook' },
    { value: 'outros', label: 'Outros' },
];

/**
 * Gestão de metadados de conteúdo publicável: prompt(s) da peça (editar,
 * copiar e gerar a peça ou um item a partir deles), artefacto (upload para
 * Storage ou link externo) e publicações multi-plataforma.
 */
export function ContentMetaManager({
    targetType,
    targetId,
    assetUrl,
    assetName,
    onAssetChange,
    piece,
    onRewritePrompt,
    isRewritingPrompt = false,
}: ContentMetaManagerProps) {
    const [publications, setPublications] = useState<ContentPublication[]>([]);
    const [assetBusy, setAssetBusy] = useState(false);
    const [externalAssetUrl, setExternalAssetUrl] = useState('');
    const [externalAssetName, setExternalAssetName] = useState('');
    const [assetMsg, setAssetMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [pubPlatform, setPubPlatform] = useState('LINKEDIN');
    const [pubUrl, setPubUrl] = useState('');
    const [pubBusy, setPubBusy] = useState(false);
    const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const isPromptTarget = targetType === 'PIECE' || targetType === 'VIDEO_SCRIPT';

    const {
        prompts,
        isLoading: isLoadingPrompts,
        savePrompt,
        generatePiece,
        generateItem,
        isBusy: isPromptBusy,
        isItemEdited,
        error: promptError,
        notice: promptNotice,
    } = usePiecePrompts(
        isPromptTarget ? targetType : 'PIECE',
        isPromptTarget ? targetId : ''
    );

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const pubs = await publicationService.getPublications(
                targetType,
                targetId
            );
            if (cancelled) return;
            setPublications(pubs);
        }

        load().catch(() => {
            // Erros de leitura não bloqueiam o modal principal.
        });
        return () => {
            cancelled = true;
        };
    }, [targetType, targetId]);

    const handleAssetFile = async (file: File) => {
        if (!onAssetChange) return;
        setAssetBusy(true);
        setAssetMsg(null);
        try {
            const uploaded = await uploadAsset(file, 'assets');
            await onAssetChange({
                assetUrl: uploaded.url,
                assetName: uploaded.name,
            });
            setAssetMsg({ ok: true, text: 'Artefacto carregado.' });
        } catch (err) {
            setAssetMsg({
                ok: false,
                text: err instanceof Error ? err.message : 'Erro ao carregar artefacto',
            });
        } finally {
            setAssetBusy(false);
        }
    };

    const handleExternalAsset = async () => {
        if (!onAssetChange || !externalAssetUrl.trim()) return;
        setAssetBusy(true);
        setAssetMsg(null);
        try {
            await onAssetChange({
                assetUrl: externalAssetUrl.trim(),
                assetName: externalAssetName.trim() || null,
            });
            setExternalAssetUrl('');
            setExternalAssetName('');
            setAssetMsg({ ok: true, text: 'Link do artefacto guardado.' });
        } catch (err) {
            setAssetMsg({
                ok: false,
                text: err instanceof Error ? err.message : 'Erro ao guardar link',
            });
        } finally {
            setAssetBusy(false);
        }
    };

    const handleRemoveAsset = async () => {
        if (!onAssetChange) return;
        setAssetBusy(true);
        setAssetMsg(null);
        try {
            await onAssetChange({ assetUrl: null, assetName: null });
            setAssetMsg({ ok: true, text: 'Artefacto removido.' });
        } catch (err) {
            setAssetMsg({
                ok: false,
                text: err instanceof Error ? err.message : 'Erro ao remover artefacto',
            });
        } finally {
            setAssetBusy(false);
        }
    };

    const handleAddPublication = async () => {
        if (!pubUrl.trim()) {
            setPubMsg({ ok: false, text: 'Indica o URL do post publicado.' });
            return;
        }
        setPubBusy(true);
        setPubMsg(null);
        try {
            const pub = await publicationService.createPublication({
                targetType,
                targetId,
                platform: pubPlatform,
                url: pubUrl.trim(),
                publishedAt: new Date().toISOString(),
            });
            setPublications((prev) => [pub, ...prev]);
            setPubUrl('');
            setPubMsg({ ok: true, text: 'Publicação registada.' });
        } catch (err) {
            setPubMsg({
                ok: false,
                text: err instanceof Error ? err.message : 'Erro ao registar publicação',
            });
        } finally {
            setPubBusy(false);
        }
    };

    const handleDeletePublication = async (id: string) => {
        try {
            await publicationService.deletePublication(id);
            setPublications((prev) => prev.filter((p) => p.id !== id));
        } catch {
            setPubMsg({ ok: false, text: 'Erro ao remover publicação.' });
        }
    };

    /**
     * Acção de geração associada a um prompt: o 'main' gera a peça, um
     * 'slide-N'/'tweet-N' regenera só esse item (carrossel e thread).
     *
     * Ao regenerar um item, o job reconstrói o prompt desse item a partir do
     * novo conteúdo. Se o utilizador o tinha escrito à mão, confirmamos antes
     * de lhe deitar fora o texto.
     */
    function generateActionFor(itemKey: string): {
        onGenerate?: () => void;
        generateLabel?: string;
    } {
        if (!piece) return {};

        if (itemKey === 'main') {
            return {
                onGenerate: () => {
                    void generatePiece(piece);
                },
                generateLabel: piece.body.trim()
                    ? 'Gerar nova versão com este prompt'
                    : 'Gerar peça com este prompt',
            };
        }

        const order = parseItemKeyOrder(itemKey);
        if (
            order === null ||
            (piece.format !== 'CAROUSEL' && piece.format !== 'THREAD')
        ) {
            return {};
        }

        return {
            onGenerate: () => {
                if (isItemEdited(itemKey) && !confirmEditedItem(itemKey)) {
                    return;
                }
                void generateItem(piece.id, itemKey);
            },
            generateLabel:
                piece.format === 'CAROUSEL'
                    ? 'Gerar este slide'
                    : 'Gerar este tweet',
        };
    }

    function confirmEditedItem(itemKey: string): boolean {
        if (itemKey === 'main') {
            return window.confirm(
                'O prompt desta peça foi editado por ti. Ao reescrevê-lo, esse texto é substituído pelo prompt que a IA vai escrever.\n\nContinuar?'
            );
        }
        return window.confirm(
            `O prompt de "${promptItemLabel(itemKey, piece?.slideCount)}" foi editado por ti. Ao regenerar o item, esse texto é substituído pelo prompt reconstruído a partir do novo conteúdo.\n\nContinuar?`
        );
    }

    /**
     * "Reescrever prompt" substitui o prompt 'main' e limpa a marca de edição
     * manual — um prompt escrito à mão desapareceria sem aviso.
     */
    function handleRewrite(): void {
        if (isItemEdited('main') && !confirmEditedItem('main')) return;
        onRewritePrompt?.();
    }

    /** Bloco do editor de prompts (prompt da peça + prompts por item). */
    const promptBlock = isPromptTarget && (
        <div>
            <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900">
                    Prompt
                </h4>
                {onRewritePrompt && (
                    <button
                        type="button"
                        onClick={handleRewrite}
                        disabled={isRewritingPrompt}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        {isRewritingPrompt
                            ? 'A escrever…'
                            : 'Reescrever prompt'}
                    </button>
                )}
            </div>

            {promptError && (
                <p className="mb-2 text-xs text-red-600">{promptError}</p>
            )}
            {promptNotice && (
                <p className="mb-2 text-xs text-blue-600">{promptNotice}</p>
            )}

            {isLoadingPrompts ? (
                <p className="text-xs text-gray-500">A carregar prompts…</p>
            ) : prompts.length === 0 ? (
                <p className="text-xs text-gray-500">
                    {onRewritePrompt
                        ? 'Ainda não há prompt guardado. Podes escrever um com "Reescrever prompt" — a peça fica à espera do prompt, sem conteúdo.'
                        : 'Ainda não há prompt guardado. A peça é criada com o prompt que a IA escreve a partir do artigo.'}
                </p>
            ) : (
                <div className="space-y-3">
                    {prompts.map((p) => (
                        <PromptEditor
                            key={p.itemKey}
                            itemKey={p.itemKey}
                            label={promptItemLabel(p.itemKey, piece?.slideCount)}
                            prompt={p.prompt}
                            editedAt={p.editedAt ?? null}
                            onSave={savePrompt}
                            isGenerating={isPromptBusy || isRewritingPrompt}
                            {...generateActionFor(p.itemKey)}
                        />
                    ))}
                </div>
            )}
        </div>
    );

    /**
     * Peça só com prompt (ainda sem conteúdo): o prompt é o trabalho a fazer,
     * por isso abre no topo, antes dos campos de conteúdo vazios.
     */
    const isPromptOnly = Boolean(piece && !piece.body.trim());

    return (
        <div className="space-y-5">
            {isPromptOnly && promptBlock}

            {/* Artefacto */}
            <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900">
                    Artefacto
                </h4>
                {assetUrl ? (
                    <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                        <a
                            href={assetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 truncate text-sm text-blue-600 hover:underline"
                        >
                            {assetName || assetUrl}
                        </a>
                        {onAssetChange && (
                            <button
                                type="button"
                                onClick={handleRemoveAsset}
                                disabled={assetBusy}
                                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                                Remover
                            </button>
                        )}
                    </div>
                ) : (
                    <p className="mb-2 text-xs text-gray-500">
                        Sem artefacto guardado.
                    </p>
                )}

                {onAssetChange && (
                    <div className="mt-2 space-y-2">
                        <input
                            type="file"
                            disabled={assetBusy}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleAssetFile(file);
                                e.target.value = '';
                            }}
                            className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={externalAssetUrl}
                                onChange={(e) => setExternalAssetUrl(e.target.value)}
                                placeholder="ou cola um link externo do artefacto"
                                className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                            />
                            <input
                                type="text"
                                value={externalAssetName}
                                onChange={(e) => setExternalAssetName(e.target.value)}
                                placeholder="Nome (opcional)"
                                className="w-40 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => void handleExternalAsset()}
                                disabled={assetBusy || !externalAssetUrl.trim()}
                                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                )}
                {assetMsg && (
                    <p
                        className={`mt-1.5 text-xs ${
                            assetMsg.ok ? 'text-green-600' : 'text-red-600'
                        }`}
                    >
                        {assetMsg.text}
                    </p>
                )}
            </div>

            {/* Publicações */}
            <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900">
                    Publicações
                </h4>
                {publications.length === 0 ? (
                    <p className="mb-2 text-xs text-gray-500">
                        Ainda sem publicações registadas.
                    </p>
                ) : (
                    <ul className="mb-2 space-y-1.5">
                        {publications.map((pub) => {
                            const platformLabel =
                                PLATFORM_OPTIONS.find(
                                    (o) => o.value === pub.platform
                                )?.label ?? pub.platform;
                            return (
                                <li
                                    key={pub.id}
                                    className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
                                >
                                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                                        {platformLabel}
                                    </span>
                                    {pub.url ? (
                                        <a
                                            href={pub.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="min-w-0 flex-1 truncate text-sm text-blue-600 hover:underline"
                                        >
                                            {pub.url}
                                        </a>
                                    ) : (
                                        <span className="flex-1 text-xs text-gray-400">
                                            sem link
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-400">
                                        {new Date(pub.publishedAt).toLocaleDateString(
                                            'pt-PT'
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleDeletePublication(pub.id)
                                        }
                                        className="shrink-0 text-xs text-red-600 hover:text-red-700"
                                    >
                                        Remover
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <div className="flex gap-2">
                    <select
                        value={pubPlatform}
                        onChange={(e) => setPubPlatform(e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                        {PLATFORM_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <input
                        type="url"
                        value={pubUrl}
                        onChange={(e) => setPubUrl(e.target.value)}
                        placeholder="URL do post publicado"
                        className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => void handleAddPublication()}
                        disabled={pubBusy || !pubUrl.trim()}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        {pubBusy ? 'A registar…' : 'Registar'}
                    </button>
                </div>
                {pubMsg && (
                    <p
                        className={`mt-1.5 text-xs ${
                            pubMsg.ok ? 'text-green-600' : 'text-red-600'
                        }`}
                    >
                        {pubMsg.text}
                    </p>
                )}
            </div>

            {/* Prompt(s) da peça — editor + acções de geração. Vai no topo
                quando a peça ainda não tem conteúdo (ver `isPromptOnly`). */}
            {!isPromptOnly && promptBlock}
        </div>
    );
}