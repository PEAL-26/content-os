import { isSafeExternalUrl } from '@/services/content-asset.service';
import { publicationService } from '@/services/publication.service';
import {
    DEFAULT_PUBLICATION_PLATFORM,
    PUBLICATION_PLATFORMS,
    toPublicationPlatform,
} from '@/services/publication-platforms';
import type { PublicationTargetType, SocialChannel } from '@/types/database';
import { useCallback, useEffect, useState } from 'react';

const PLATFORM_OPTIONS = PUBLICATION_PLATFORMS;

interface PublicationsPanelProps {
    targetType: PublicationTargetType;
    targetId: string;
    title?: string;
    /**
     * Disparado depois de um create ou de um delete bem-sucedidos — nunca
     * numa falha e nunca quando o update otimista reverte. Serve para o
     * painel irmão da página de detalhe recarregar, porque cada instância
     * tem o seu próprio estado.
     */
    onChanged?: () => void;
    /**
     * Quando muda, o painel volta a carregar do servidor. É o par de
     * `onChanged`: o modal de edição incrementa o valor na página e este
     * painel mostra a publicação sem esperar por um recarregamento.
     */
    reloadKey?: number;
}

/**
 * Publicações multi-plataforma de uma entidade. Carrega os seus próprios dados
 * a partir de (targetType, targetId), por isso serve os modais e as páginas de
 * detalhe sem props de dados.
 */
export function PublicationsPanel({
    targetType,
    targetId,
    title = 'Publicações',
    onChanged,
    reloadKey = 0,
}: PublicationsPanelProps) {
    const [publications, setPublications] = useState<
        Awaited<ReturnType<typeof publicationService.getPublications>>
    >([]);
    // Tipado como `SocialChannel` (e não `string`) porque é o que a coluna
    // espera — um `string` permitia gravar um valor fora do enum.
    const [platform, setPlatform] =
        useState<SocialChannel>(DEFAULT_PUBLICATION_PLATFORM);
    const [url, setUrl] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
        null
    );

    const load = useCallback(async () => {
        try {
            setPublications(
                await publicationService.getPublications(
                    targetType,
                    targetId
                )
            );
        } catch {
            // Erros de leitura não bloqueiam o painel principal.
        }
    }, [targetType, targetId]);

    useEffect(() => {
        void load();
        // `reloadKey` entra só para forçar o recarregamento quando a página
        // o incrementa (o `load` em si não depende dele — o valor só muda a
        // altura da repetição da consulta, não o que ela consulta).
    }, [load, reloadKey]);

    const handleAdd = async () => {
        if (!url.trim()) {
            setMessage({ ok: false, text: 'Indica o URL do post publicado.' });
            return;
        }

        setIsBusy(true);
        setMessage(null);
        try {
            const created = await publicationService.createPublication({
                targetType,
                targetId,
                platform,
                url: url.trim(),
                publishedAt: new Date().toISOString(),
            });
            setPublications((prev) => [created, ...prev]);
            setUrl('');
            setMessage({ ok: true, text: 'Publicação registada.' });
            // Fora do `catch`: o painel irmão só recarrega por uma criação real.
            onChanged?.();
        } catch (err) {
            setMessage({
                ok: false,
                text:
                    err instanceof Error
                        ? err.message
                        : 'Erro ao registar publicação',
            });
        } finally {
            setIsBusy(false);
        }
    };

    const handleDelete = async (id: string) => {
        const previous = publications;
        setPublications((prev) => prev.filter((p) => p.id !== id));

        try {
            await publicationService.deletePublication(id);
            // Depois do `await` e fora do `catch`: se o delete falhou há
            // reversão do update otimista e nada mudou para o outro painel.
            onChanged?.();
        } catch {
            setPublications(previous);
            setMessage({ ok: false, text: 'Erro ao remover publicação.' });
        }
    };

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900">
                    {title}
                    {publications.length > 0 && (
                        <span className="ml-1.5 font-normal text-gray-500">
                            ({publications.length})
                        </span>
                    )}
                </h4>
            </div>

            {publications.length === 0 ? (
                <p className="mb-2 text-xs text-gray-500">
                    Ainda sem publicações registadas.
                </p>
            ) : (
                <ul className="mb-2 space-y-1.5">
                    {publications.map((pub) => {
                        const label =
                            PLATFORM_OPTIONS.find(
                                (o) => o.value === pub.platform
                            )?.label ?? pub.platform;
                        // Validação no caminho de renderização: a publicação
                        // pode ter sido criada antes de haver validação, e um
                        // `javascript:` num href é executado ao clicar.
                        const safeLink =
                            Boolean(pub.url) && isSafeExternalUrl(pub.url);

                        return (
                            <li
                                key={pub.id}
                                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5"
                            >
                                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                                    {label}
                                </span>
                                {pub.publishedAt && (
                                    <span className="shrink-0 text-[10px] text-gray-500">
                                        {new Date(
                                            pub.publishedAt
                                        ).toLocaleDateString('pt-PT')}
                                    </span>
                                )}
                                {/*
                                    Só o link validado vira `<a>`; caso
                                    contrário mostramos o texto sem link.
                                */}
                                {safeLink ? (
                                    <a
                                        href={pub.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="min-w-0 flex-1 truncate text-xs text-blue-600 hover:underline"
                                    >
                                        {pub.url}
                                    </a>
                                ) : (
                                    <span
                                        title={
                                            pub.url
                                                ? 'Esquema não http/https — link bloqueado'
                                                : undefined
                                        }
                                        className="min-w-0 flex-1 truncate text-xs text-gray-400"
                                    >
                                        {pub.url ? 'link bloqueado' : 'sem link'}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void handleDelete(pub.id)}
                                    className="shrink-0 text-[10px] text-red-600 hover:text-red-700"
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
                    value={platform}
                    onChange={(e) =>
                            setPlatform(toPublicationPlatform(e.target.value))
                        }
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                >
                    {PLATFORM_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="URL do post publicado"
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
                <button
                    type="button"
                    onClick={() => void handleAdd()}
                    disabled={isBusy || !url.trim()}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    {isBusy ? '…' : 'Registar'}
                </button>
            </div>

            {message && (
                <p
                    className={`mt-1.5 text-xs ${
                        message.ok ? 'text-green-600' : 'text-red-600'
                    }`}
                >
                    {message.text}
                </p>
            )}
        </div>
    );
}