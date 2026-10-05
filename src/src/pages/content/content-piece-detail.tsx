import { ChannelBadge } from '@/components/channels/channel-badge';
import { ArtefactsPanel } from '@/components/content/artefacts-panel';
import { ContentNotFound } from '@/components/content/content-not-found';
import { ContentPieceModal } from '@/components/content/content-piece-modal';
import { ContentPromptsPanel } from '@/components/content/content-prompts-panel';
import { CopyMenu } from '@/components/content/copy-menu';
import { PiecePreview } from '@/components/content/piece-preview';
import { PillarBadge } from '@/components/content/pillar-badge';
import { PublicationsPanel } from '@/components/content/publications-panel';
import { useGenerationJob } from '@/hooks/use-generation-job';
import { useGenerationJobsForTargets } from '@/hooks/use-generation-jobs';
import { useWorkspaceContentPieces } from '@/hooks/use-workspace-content-pieces';
import { suggestPlatformForPiece } from '@/lib/social-text/suggest-platform';
import { workspacePath } from '@/lib/workspace-paths';
import { contentPieceService } from '@/services/content-piece.service';
import { generationJobService } from '@/services/generation-job.service';
import { useGenerationJobStore } from '@/stores/generation-jobs-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import type { ContentPieceWithRelations, ContentSlide } from '@/types/database';
import {
    CONTENT_FORMAT_ICONS,
    CONTENT_FORMAT_LABELS,
    CONTENT_PIECE_STATUS_COLORS,
    CONTENT_PIECE_STATUS_LABELS,
} from '@/types/database';
import type { ContentPillar } from '@/types/pillar';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

/**
 * Página de detalhe de uma peça: conteúdo em leitura + artefactos e publicações.
 * A edição vive no ContentPieceModal; aqui o botão "Editar" abre-o.
 */
export function ContentPieceDetailPage() {
    const { workspaceId, id } = useParams<{
        workspaceId: string;
        id: string;
    }>();
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspaceStore();
    const rememberJob = useGenerationJobStore((s) => s.rememberJob);
    const { updatePiece, approvePiece, deletePiece, error } =
        useWorkspaceContentPieces();

    const [piece, setPiece] = useState<ContentPieceWithRelations | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    /** "Reescrever prompt": pedido em curso + aviso (sucesso ou erro). */
    const [isRewritingPromptRequest, setIsRewritingPromptRequest] =
        useState(false);
    const [rewriteMsg, setRewriteMsg] = useState<{
        ok: boolean;
        text: string;
    } | null>(null);
    const [reloadTick, setReloadTick] = useState(0);
    /**
     * Só para os painéis da barra lateral: cada um é outra instância do
     * `ArtefactsPanel`/`PublicationsPanel` que vive dentro do modal, por isso
     * precisam de um empurrão explícito para mostrar o que mudou lá dentro.
     * Um único contador serve aos dois.
     */
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        if (!id) return;

        setIsLoading(true);
        setLoadError(null);
        try {
            setPiece(
                await contentPieceService.getContentPiece(workspaceId ?? '', id)
            );
        } catch (err) {
            setLoadError(
                err instanceof Error ? err.message : 'Erro ao carregar a peça'
            );
        } finally {
            setIsLoading(false);
        }
    }, [id, workspaceId]);

    useEffect(() => {
        void load();
    }, [load, reloadTick]);

    // Refresca a peça quando um job de geração por item termina, para o preview
    // não ficar preso no conteúdo antigo. "Gerar peça" enfileira
    // CONTENT_PIECES; "Gerar este slide / tweet" enfileira CONTENT_ITEM — ambos
    // com targetId = a peça, por isso basta combinar os dois estados.
    const { jobsByTarget: pieceJobs } = useGenerationJobsForTargets(
        'CONTENT_PIECES',
        piece ? [piece.id] : []
    );
    const { jobsByTarget: itemJobs } = useGenerationJobsForTargets(
        'CONTENT_ITEM',
        piece ? [piece.id] : []
    );
    const generationStatus = piece
        ? itemJobs[piece.id]?.status === 'COMPLETED'
            ? 'COMPLETED'
            : pieceJobs[piece.id]?.status
        : undefined;

    // Enquanto o job CONTENT_PROMPT do artigo está a correr, "Reescrever
    // prompt" tem de ficar desligado: com o estado local sozinho, o `finally` de
    // `handleRewritePrompt` limpava-o assim que o POST voltava e dois cliques
    // enfileiravam dois CONTENT_PROMPT para a mesma peça.
    const promptJob = useGenerationJob(
        piece
            ? {
                  kind: 'target',
                  jobType: 'CONTENT_PROMPT',
                  targetId: piece.articleId,
              }
            : null
    );
    const isRewritingPrompt = isRewritingPromptRequest || promptJob.isActive;

    useEffect(() => {
        if (generationStatus === 'COMPLETED') {
            setReloadTick((t) => t + 1);
        }
    }, [generationStatus]);

    /**
     * `updatePiece`/`approvePiece` devolvem `false` em vez de lançar (o hook
     * apanha o erro e escreve-o no seu próprio `error`), por isso o `try` à
     * volta delas nunca via nada. Sem o booleano, uma falha de rede/RLS
     * descartava as edições do utilizador e fechava o modal como se tivessem
     * sido gravadas.
     */
    const handleSave = async (data: {
        title: string | null;
        body: string;
        hookText: string | null;
        ctaText: string | null;
        hashtags: string[];
        slides: ContentSlide[] | null;
        channelId: string | null;
    }) => {
        if (!piece) return;
        setIsSaving(true);
        setActionError(null);
        try {
            const ok = await updatePiece(piece.id, data);
            if (!ok) {
                // O modal fica aberto: o texto que o utilizador escreveu ainda
                // está lá e é o que ele quer ver quando a falha for mostrada.
                setActionError('Erro ao guardar a peça.');
                return;
            }
            setIsEditOpen(false);
            setReloadTick((t) => t + 1);
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!piece) return;
        setActionError(null);
        const ok = await approvePiece(piece.id);
        if (!ok) {
            setActionError('Erro ao aprovar a peça.');
            return;
        }
        setReloadTick((t) => t + 1);
    };

    /**
     * Elimina a peça e volta à listagem. `deletePiece` já devolve `false` em
     * vez de lançar, por isso o erro vem pelo hook.
     */
    const handleDelete = async () => {
        if (!piece) return;
        if (
            !window.confirm(
                'Eliminar esta peça? Esta acção não pode ser revertida.'
            )
        ) {
            return;
        }

        setActionError(null);
        const ok = await deletePiece(piece.id);
        if (ok) {
            navigate(workspacePath(workspaceId ?? '', 'content'));
        } else {
            setActionError('Erro ao eliminar a peça.');
        }
    };

    /**
     * Reescreve o prompt desta peça (job CONTENT_PROMPT), como na listagem: o
     * botão do modal só existe se a página lhe passar o callback.
     *
     * O job é escrito por `articleId`, por isso é esse o alvo a seguir no estado
     * — e é ele que mantém o botão desligado enquanto a escrita decorre (o
     * `finally` local só dura até o POST voltar).
     */
    const handleRewritePrompt = async () => {
        if (!piece || !currentWorkspace) return;
        if (isRewritingPrompt) return;

        setRewriteMsg(null);
        setIsRewritingPromptRequest(true);
        try {
            const result = await generationJobService.enqueue({
                workspaceId: currentWorkspace.id,
                jobType: 'CONTENT_PROMPT',
                params: {
                    articleId: piece.articleId,
                    formats: [piece.format],
                    // Sem isto o prompt saía sem produto e sem o canal da peça.
                    productId: piece.productId ?? null,
                    channelIds: piece.channelId
                        ? { [piece.format]: piece.channelId }
                        : undefined,
                },
                targets: [{ format: piece.format, targetId: piece.id }],
            });
            rememberJob({
                jobType: 'CONTENT_PROMPT',
                targetId: piece.articleId,
                jobId: result.jobId,
            });
            setRewriteMsg({
                ok: true,
                text: 'A escrever o prompt em segundo plano. A caixa actualiza-se sozinha quando terminar.',
            });
        } catch (err) {
            setRewriteMsg({
                ok: false,
                text:
                    err instanceof Error
                        ? err.message
                        : 'Erro ao reescrever o prompt.',
            });
        } finally {
            setIsRewritingPromptRequest(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        );
    }

    if (loadError || !piece) {
        return (
            <ContentNotFound
                workspaceId={workspaceId ?? ''}
                message={loadError ?? undefined}
                onRetry={() => void load()}
            />
        );
    }

    const statusColors = CONTENT_PIECE_STATUS_COLORS[piece.status];
    const isPromptOnly = piece.status === 'PROMPT_READY' && !piece.body.trim();
    /**
     * Uma peça só com prompt (PROMPT_READY sem corpo) não tem o que copiar.
     * Uma peça com corpo mas sem hook continua a ter — o corpo é o conteúdo.
     */
    const hasContent =
        Boolean(piece.body.trim()) ||
        Boolean(piece.hookText?.trim()) ||
        Boolean(piece.ctaText?.trim());

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* Cabeçalho */}
            <div className="border-b bg-white px-6 py-4">
                <Link
                    to={workspacePath(workspaceId ?? '', 'content')}
                    className="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
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
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                    Peças
                </Link>

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xl">
                                {CONTENT_FORMAT_ICONS[piece.format]}
                            </span>
                            <h1 className="text-lg font-semibold text-gray-900">
                                {piece.title ||
                                    CONTENT_FORMAT_LABELS[piece.format]}
                            </h1>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                            >
                                {CONTENT_PIECE_STATUS_LABELS[piece.status]}
                            </span>
                            {piece.channel && (
                                <ChannelBadge
                                    channel={piece.channel.channel}
                                    size="sm"
                                />
                            )}
                            {piece.pillar && (
                                <PillarBadge
                                    pillar={piece.pillar as ContentPillar}
                                    size="sm"
                                />
                            )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            {piece.article && (
                                <Link
                                    to={workspacePath(
                                        workspaceId ?? '',
                                        `articles/${piece.article.id}/edit`
                                    )}
                                    className="text-blue-600 hover:underline"
                                >
                                    Ver artigo de origem
                                </Link>
                            )}
                            {piece.publishedAt && (
                                <span>
                                    Publicado em{' '}
                                    {new Date(
                                        piece.publishedAt
                                    ).toLocaleDateString('pt-PT')}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            onClick={() => setIsEditOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                            Editar
                        </button>

                        {piece.status === 'DRAFT' && (
                            <button
                                onClick={() => void handleApprove()}
                                className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                            >
                                Aprovar
                            </button>
                        )}

                        {piece && (
                            <CopyMenu
                                source={{ type: 'piece', piece }}
                                disabled={!hasContent}
                                variant="button"
                                defaultPlatform={suggestPlatformForPiece(piece)}
                            />
                        )}

                        <button
                            onClick={() => void handleDelete()}
                            className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>

                {actionError && (
                    <p className="mt-2 text-sm text-red-600">{actionError}</p>
                )}

                {/* A mensagem do hook (que sabe o erro do Supabase) fica
                    visível ao lado da acção que a produziu. */}
                {error && (
                    <div className="mt-2 rounded-md bg-red-50 p-4">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {rewriteMsg && (
                    <p
                        className={`mt-2 text-sm ${
                            rewriteMsg.ok ? 'text-green-700' : 'text-red-700'
                        }`}
                    >
                        {rewriteMsg.text}
                    </p>
                )}
            </div>

            {/* Corpo: 70% conteúdo / 30% metadados */}
            <div className="flex flex-1 overflow-hidden">
                <div className="flex w-[70%] flex-col overflow-y-auto border-r border-b border-l">
                    <div className="space-y-5 p-4">
                        {isPromptOnly && (
                            <ContentPromptsPanel
                                targetType="PIECE"
                                targetId={piece.id}
                                piece={{
                                    id: piece.id,
                                    format: piece.format,
                                    body: piece.body,
                                    slideCount: piece.slideCount,
                                }}
                            />
                        )}

                        <PiecePreview piece={piece} compact={false} />

                        {!isPromptOnly && (
                            <ContentPromptsPanel
                                targetType="PIECE"
                                targetId={piece.id}
                                piece={{
                                    id: piece.id,
                                    format: piece.format,
                                    body: piece.body,
                                    slideCount: piece.slideCount,
                                }}
                            />
                        )}
                    </div>
                </div>

                <div className="w-[30%] space-y-5 overflow-y-auto border-r border-b bg-gray-50 p-4">
                    <ArtefactsPanel
                        targetType="PIECE"
                        targetId={piece.id}
                        reloadKey={reloadKey}
                    />
                    <PublicationsPanel
                        targetType="PIECE"
                        targetId={piece.id}
                        reloadKey={reloadKey}
                    />
                </div>
            </div>

            <ContentPieceModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                piece={piece}
                onSave={handleSave}
                onRewritePrompt={() => void handleRewritePrompt()}
                isRewritingPrompt={isRewritingPrompt}
                isSaving={isSaving}
                onAssetsChanged={() => setReloadKey((k) => k + 1)}
            />
        </div>
    );
}
