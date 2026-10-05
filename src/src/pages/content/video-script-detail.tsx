import { ChannelBadge } from '@/components/channels/channel-badge';
import { ArtefactsPanel } from '@/components/content/artefacts-panel';
import { ContentNotFound } from '@/components/content/content-not-found';
import { ContentPromptsPanel } from '@/components/content/content-prompts-panel';
import { CopyMenu } from '@/components/content/copy-menu';
import { PublicationsPanel } from '@/components/content/publications-panel';
import { VideoScriptModal } from '@/components/content/video-script-modal';
import { useGenerationJob } from '@/hooks/use-generation-job';
import { useVideoScripts } from '@/hooks/use-video-scripts';
import { calculateDurationFromScript, calculateReadingTime } from '@/lib/ai';
import { suggestPlatformForScript } from '@/lib/social-text/suggest-platform';
import { workspacePath } from '@/lib/workspace-paths';
import {
    defaultJobParams,
    generationJobService,
} from '@/services/generation-job.service';
import {
    videoScriptService,
    type VideoScriptWithRelations,
} from '@/services/video-script.service';
import { useGenerationJobStore } from '@/stores/generation-jobs-store';
import { ARTICLE_STATUS_COLORS, ARTICLE_STATUS_LABELS } from '@/types/database';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

/**
 * Página de detalhe de um roteiro de vídeo.
 *
 * Recebe o conteúdo que vivia dentro do acordeão do card (blocos do roteiro,
 * artefactos, publicações, copiar/aprovar/eliminar, retry de geração), que foi
 * removido quando o card passou a navegar para cá.
 */
export function VideoScriptDetailPage() {
    const { workspaceId, id } = useParams<{
        workspaceId: string;
        id: string;
    }>();
    const navigate = useNavigate();
    const { approveScript, deleteScript, refetch } = useVideoScripts();
    const rememberJob = useGenerationJobStore((s) => s.rememberJob);

    const [script, setScript] = useState<VideoScriptWithRelations | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    /** Aviso do "Reescrever prompt" (job enfileirado, ou erro de enqueue). */
    const [rewriteMsg, setRewriteMsg] = useState<{
        ok: boolean;
        text: string;
    } | null>(null);
    const [isRewritingRequest, setIsRewritingRequest] = useState(false);
    /**
     * Só para os painéis da barra lateral: cada um é outra instância do
     * `ArtefactsPanel`/`PublicationsPanel` que vive dentro do modal, por isso
     * precisam de um empurrão explícito para mostrar o que mudou lá dentro.
     * Um único contador serve aos dois.
     */
    const [reloadKey, setReloadKey] = useState(0);
    /**
     * O painel de prompts não segue o job VIDEO_SCRIPT (só o CONTENT_PROMPT das
     * peças), por isso a releitura do prompt novo é forçada por aqui, quando a
     * geração termina.
     */
    const [promptsKey, setPromptsKey] = useState(0);

    const load = useCallback(async () => {
        if (!id) return;

        setIsLoading(true);
        setLoadError(null);
        try {
            // Filtro por workspace dentro da query (o RLS está desligado) —
            // antes esta página descarregava todos os roteiros e filtrava por
            // id no cliente.
            setScript(
                await videoScriptService.getVideoScript(workspaceId ?? '', id)
            );
        } catch (err) {
            setLoadError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao carregar o roteiro'
            );
        } finally {
            setIsLoading(false);
        }
    }, [id, workspaceId]);

    useEffect(() => {
        void load();
    }, [load]);

    const genJob = useGenerationJob({
        kind: 'target',
        jobType: 'VIDEO_SCRIPT',
        targetId: id ?? '',
    });

    /**
     * "Reescrever prompt" enfileira um job VIDEO_SCRIPT (ver `regenerateScript`):
     * o botão tem de ficar desligado durante o pedido E durante a geração, senão
     * dois cliques enfileiram dois jobs para o mesmo roteiro.
     */
    const isRewritingPrompt = isRewritingRequest || genJob.isActive;

    // Refresca quando a geração em segundo plano termina. O prompt foi
    // reescrito pelo mesmo job, por isso o painel de prompts também é relido.
    useEffect(() => {
        if (genJob.job?.status === 'COMPLETED') {
            setPromptsKey((k) => k + 1);
            void load();
        }
    }, [genJob.job?.status, load]);

    const handleSave = async (data: {
        title: string;
        hook: string;
        problem: string | null;
        solution: string | null;
        cta: string;
        fullScript: string;
        durationSec: number;
        targetChannel: Parameters<
            typeof videoScriptService.updateVideoScript
        >[1]['targetChannel'];
        onScreenText: string[];
        bRoll: string[];
    }) => {
        setIsSaving(true);
        try {
            await videoScriptService.updateVideoScript(id!, data);
            setIsEditOpen(false);
            await load();
        } catch (err) {
            setActionError(
                err instanceof Error ? err.message : 'Erro ao guardar o roteiro'
            );
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Regenera este roteiro. Reutiliza o roteiro existente como target (em vez
     * de criar um placeholder novo), seguindo o mesmo caminho do retry na
     * listagem. Devolve `false` quando o enqueue falha — o erro fica escrito em
     * `actionError`, como nas restantes acções da página.
     *
     * É também o caminho de "Reescrever prompt": num VIDEO_SCRIPT não existe um
     * job só de prompt, o job escreve o prompt portátil e o roteiro no mesmo
     * passo (ver `runVideoScript` no servidor), por isso reescrever o prompt é
     * gerar o roteiro de novo — o conteúdo é substituído com ele.
     */
    const regenerateScript = async (): Promise<boolean> => {
        if (!script) return false;
        setActionError(null);
        try {
            const result = await generationJobService.enqueue({
                workspaceId: script.workspaceId,
                jobType: 'VIDEO_SCRIPT',
                params: genJob.job?.params ?? defaultJobParams('VIDEO_SCRIPT'),
                targets: [{ format: 'VIDEO_SCRIPT', targetId: script.id }],
            });
            rememberJob({
                jobType: 'VIDEO_SCRIPT',
                targetId: script.id,
                jobId: result.jobId,
            });
            await refetch();
            return true;
        } catch (err) {
            setActionError(
                err instanceof Error
                    ? err.message
                    : 'Erro ao tentar gerar novamente'
            );
            return false;
        }
    };

    const handleRetry = async () => {
        await regenerateScript();
    };

    /** "Reescrever prompt" do modal (ver `regenerateScript`). */
    const handleRewritePrompt = async () => {
        if (!script || isRewritingPrompt) return;

        // Ao contrário da peça, aqui reescrever o prompt substitui o roteiro
        // (ver `regenerateScript`) — e o modal pode ter texto por guardar, que
        // essa geração deita fora. Por isso pergunta antes.
        if (
            !window.confirm(
                'Reescrever o prompt de um roteiro volta a gerar o roteiro a partir do artigo.\n\nO conteúdo actual (e o que ainda não guardaste no modal) é substituído.\n\nContinuar?'
            )
        ) {
            return;
        }

        setRewriteMsg(null);
        setIsRewritingRequest(true);
        const queued = await regenerateScript();
        if (queued) {
            setRewriteMsg({
                ok: true,
                text: 'A escrever o prompt em segundo plano. O roteiro e o prompt actualizam-se sozinhos quando terminar.',
            });
        }
        setIsRewritingRequest(false);
    };

    /**
     * `approveScript`/`deleteScript` devolvem `false` em vez de lançar (o hook
     * apanha o erro e escreve-o no seu próprio estado), por isso o `try` à volta
     * delas nunca via nada: sem o booleano, uma falha de rede/RLS levava o
     * utilizador para a listagem como se a elimissão tivesse acontecido.
     */
    const handleApprove = async () => {
        if (!script) return;
        setActionError(null);
        const ok = await approveScript(script.id);
        if (!ok) {
            setActionError('Erro ao aprovar o roteiro.');
            return;
        }
        await load();
    };

    const handleDelete = async () => {
        if (!script) return;
        if (
            !window.confirm(
                'Eliminar este roteiro? Esta acção não pode ser revertida.'
            )
        ) {
            return;
        }

        setActionError(null);
        const ok = await deleteScript(script.id);
        if (ok) {
            // Navegação SPA: `window.location.href` recarregava a app inteira
            // e perdia o estado do store.
            navigate(workspacePath(workspaceId ?? '', 'video-scripts'));
        } else {
            setActionError('Erro ao eliminar o roteiro.');
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-1 items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        );
    }

    if (loadError || !script) {
        return (
            <ContentNotFound
                workspaceId={workspaceId ?? ''}
                backTo="video-scripts"
                backLabel="Voltar a Roteiros"
                message={loadError ?? undefined}
                onRetry={() => void load()}
            />
        );
    }

    const statusColor = ARTICLE_STATUS_COLORS[script.status];
    const generation = genJob.job
        ? (genJob.job.status as 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED')
        : null;
    const generationError = genJob.job?.error ?? null;

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b bg-white px-6 py-4">
                <Link
                    to={workspacePath(workspaceId ?? '', 'video-scripts')}
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
                    Roteiros
                </Link>

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xl">🎬</span>
                            <h1 className="text-lg font-semibold text-gray-900">
                                {script.title}
                            </h1>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                            >
                                {ARTICLE_STATUS_LABELS[script.status]}
                            </span>
                            <ChannelBadge
                                channel={script.targetChannel}
                                size="sm"
                            />
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            {script.article && (
                                <Link
                                    to={workspacePath(
                                        workspaceId ?? '',
                                        `articles/${script.article.id}/edit`
                                    )}
                                    className="text-blue-600 hover:underline"
                                >
                                    Ver artigo de origem
                                </Link>
                            )}
                            <span>
                                Alvo: {script.durationSec}s · real{' '}
                                {calculateDurationFromScript(script.fullScript)}
                                s · ~{calculateReadingTime(script.fullScript)}{' '}
                                min de leitura
                            </span>
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

                        {script.status === 'DRAFT' && (
                            <button
                                onClick={() => void handleApprove()}
                                className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                            >
                                Aprovar
                            </button>
                        )}

                        {/* O único botão de copiar da página: o cabeçalho é o
                            sítio das acções (Decisão 4), e é onde o detalhe da
                            peça o tem. A versão que vivia no corpo do roteiro
                            foi removida para não haver dois. */}
                        {script && (
                            <CopyMenu
                                source={{ type: 'videoScript', script }}
                                disabled={!script.fullScript.trim()}
                                variant="button"
                                defaultPlatform={suggestPlatformForScript(
                                    script.targetChannel
                                )}
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

            {generation && generation !== 'COMPLETED' && (
                <div
                    className={
                        generation === 'FAILED'
                            ? 'border-b border-red-100 bg-red-50 px-6 py-2'
                            : 'border-b border-blue-100 bg-blue-50 px-6 py-2'
                    }
                >
                    {generation === 'FAILED' ? (
                        <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 text-xs text-red-700">
                                {generationError ||
                                    'A geração deste roteiro falhou.'}
                            </p>
                            <button
                                onClick={() => void handleRetry()}
                                className="shrink-0 rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    ) : (
                        <p className="text-xs text-blue-700">
                            A gerar o roteiro em segundo plano…
                        </p>
                    )}
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                <div className="flex w-[70%] flex-col overflow-y-auto border-r border-b border-l">
                    <div className="space-y-4 p-4">
                        <ScriptBlock label="HOOK (3s)" tone="yellow">
                            {script.hook}
                        </ScriptBlock>

                        {script.problem && (
                            <ScriptBlock
                                label={`PROBLEMA (~${Math.round(
                                    script.durationSec * 0.15
                                )}s)`}
                            >
                                {script.problem}
                            </ScriptBlock>
                        )}

                        {script.solution && (
                            <ScriptBlock
                                label={`SOLUÇÃO (~${Math.round(
                                    script.durationSec * 0.6
                                )}s)`}
                            >
                                {script.solution}
                            </ScriptBlock>
                        )}

                        {script.fullScript && (
                            <ScriptBlock
                                label={`ROTEIRO COMPLETO (~${calculateDurationFromScript(
                                    script.fullScript
                                )}s)`}
                            >
                                {script.fullScript}
                            </ScriptBlock>
                        )}

                        <ScriptBlock label="CTA" tone="green">
                            {script.cta}
                        </ScriptBlock>

                        {script.onScreenText.length > 0 && (
                            <ScriptBlock label="TEXTO PARA ECRÃ">
                                <ul className="space-y-1">
                                    {script.onScreenText.map((text, i) => (
                                        <li key={i} className="text-gray-700">
                                            {text}
                                        </li>
                                    ))}
                                </ul>
                            </ScriptBlock>
                        )}

                        {script.bRoll.length > 0 && (
                            <ScriptBlock label="SUGESTÕES B-ROLL">
                                <ul className="space-y-1">
                                    {script.bRoll.map((item, i) => (
                                        <li key={i} className="text-gray-700">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </ScriptBlock>
                        )}

                        <ContentPromptsPanel
                            targetType="VIDEO_SCRIPT"
                            targetId={script.id}
                            reloadKey={promptsKey}
                        />
                    </div>
                </div>

                <div className="w-[30%] space-y-5 overflow-y-auto border-r border-b bg-gray-50 p-4">
                    <ArtefactsPanel
                        targetType="VIDEO_SCRIPT"
                        targetId={script.id}
                        reloadKey={reloadKey}
                    />
                    <PublicationsPanel
                        targetType="VIDEO_SCRIPT"
                        targetId={script.id}
                        reloadKey={reloadKey}
                    />
                </div>
            </div>

            <VideoScriptModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                script={script}
                onSave={handleSave}
                onRewritePrompt={() => void handleRewritePrompt()}
                isRewritingPrompt={isRewritingPrompt}
                promptsReloadKey={promptsKey}
                isSaving={isSaving}
                onAssetsChanged={() => setReloadKey((k) => k + 1)}
            />
        </div>
    );
}

function ScriptBlock({
    label,
    tone = 'gray',
    children,
}: {
    label: string;
    tone?: 'gray' | 'yellow' | 'green';
    children: React.ReactNode;
}) {
    const toneClass = {
        gray: 'border-gray-200 bg-gray-50',
        yellow: 'border-yellow-100 bg-yellow-50',
        green: 'border-green-100 bg-green-50',
    }[tone];

    return (
        <div>
            {/* Não é um <label>: o bloco abaixo é só texto, não um
                controlo de formulário associável. */}
            <p className="mb-1 block text-xs font-medium text-gray-500">
                {label}
            </p>
            <div
                className={`rounded border p-3 text-sm whitespace-pre-wrap text-gray-800 ${toneClass}`}
            >
                {children}
            </div>
        </div>
    );
}
