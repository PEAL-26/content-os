import { ChannelBadge } from '@/components/channels/channel-badge';
import {
    AIProviderPicker,
    type AIProviderSelection,
} from '@/components/ai/ai-provider-picker';
import { useChannels } from '@/hooks/use-channels';
import { useContentPieces } from '@/hooks/use-content-pieces';
import { useGenerationJob } from '@/hooks/use-generation-job';
import {
    getMainPromptsForPieces,
    type MainPiecePrompt,
} from '@/services/ai-prompt.service';
import {
    defaultJobParams,
    generationJobService,
    type GenerationJobItem,
} from '@/services/generation-job.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useGenerationJobStore } from '@/stores/generation-jobs-store';
import type {
    Article,
    ContentFormat,
    ContentPieceWithRelations,
    Product,
} from '@/types/database';
import {
    CHANNEL_LABELS,
    CONTENT_FORMAT_DEFAULTS,
    CONTENT_FORMAT_LABELS,
    CONTENT_PIECE_STATUS_COLORS,
    CONTENT_PIECE_STATUS_LABELS,
} from '@/types/database';
import type { PillarConfig } from '@/types/pillar';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { ContentPieceModal } from './content-piece-modal';

interface ContentGeneratorPanelProps {
    article: Article;
    product?: Product;
    pillar?: PillarConfig;
}

const ALL_FORMATS: ContentFormat[] = [
    'CAROUSEL',
    'LINKEDIN_POST',
    'IMAGE',
    'SHORT_VIDEO',
    'CTA_POST',
    'THREAD',
    'VIDEO_SCRIPT',
];

/** Cadência de consulta dos jobs CONTENT_ITEM enquanto algum está activo. */
const ITEM_POLL_MS = 4_000;

const FORMAT_ICONS: Record<ContentFormat, string> = {
    CAROUSEL: '📱',
    LINKEDIN_POST: '💼',
    IMAGE: '📸',
    SHORT_VIDEO: '🎬',
    CTA_POST: '🔗',
    THREAD: '🧵',
    VIDEO_SCRIPT: '📝',
};

export function ContentGeneratorPanel({
    article,
    product,
    pillar,
}: ContentGeneratorPanelProps) {
    const {
        pieces,
        updatePiece,
        approvePiece,
        deletePiece,
        refetch: refetchPieces,
    } = useContentPieces(article.id);

    const pieceIds = useMemo(() => pieces.map((p) => p.id), [pieces]);

    const { currentWorkspace } = useWorkspaceStore();
    const rememberJob = useGenerationJobStore((s) => s.rememberJob);

    // Estado da geração assíncrona (CONTENT_PIECES) deste artigo — segue o
    // job mais recente (retry/regenerar criam jobs novos no mesmo alvo).
    const genJob = useGenerationJob({
        kind: 'target',
        jobType: 'CONTENT_PIECES',
        targetId: article.id,
    });

    // Job de escrita de prompts (CONTENT_PROMPT) deste artigo — segue o mais
    // recente, para o botão "Gerar apenas o prompt" reflectir o estado.
    const promptJob = useGenerationJob({
        kind: 'target',
        jobType: 'CONTENT_PROMPT',
        targetId: article.id,
    });

    // Itens em regeneração (CONTENT_ITEM): cada peça pode ter o seu job.
    // Sem subscrição (o realtime só cobre `generation_jobs`), por isso
    // consultamos e voltamos a consultar enquanto algum estiver activo — o
    // spinner do card tem de desaparecer sozinho e o slide tem de actualizar.
    const [promptItemJobs, setPromptItemJobs] = useState<GenerationJobItem[]>([]);
    const pieceIdsKey = pieceIds.join(',');

    const loadItemJobs = useCallback(async () => {
        const ids = pieceIdsKey ? pieceIdsKey.split(',') : [];
        if (ids.length === 0) {
            setPromptItemJobs([]);
            return false;
        }
        const jobs = await generationJobService.getLatestJobsForTargets(
            'CONTENT_ITEM',
            ids
        );
        const items = Object.values(jobs).flatMap((j) => j.items ?? []);
        setPromptItemJobs(items);
        return items.some((i) => i.status === 'QUEUED' || i.status === 'RUNNING');
    }, [pieceIdsKey]);

    /**
     * Muda quando um CONTENT_ITEM muda de estado. Serve de dependência do
     * carregamento dos prompts do card: `runContentItem` reconstrói o prompt do
     * item, e sem isto o "Copiar"/"Gerar peça" ficariam com o texto antigo
     * depois de um "Gerar este slide".
     */
    const itemJobsKey = useMemo(
        () =>
            promptItemJobs
                .map((i) => `${i.targetId}:${i.status}:${i.error ?? ''}`)
                .join('|'),
        [promptItemJobs]
    );

    useEffect(() => {
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let wasActive = false;

        const tick = async () => {
            let active = false;
            try {
                active = await loadItemJobs();
            } catch {
                // Silencioso — o estado do item é informativo.
            }
            if (cancelled) return;
            // Saiu de activo → o conteúdo da peça mudou, vale a pena reler.
            if (wasActive && !active) {
                void refetchPieces();
            }
            wasActive = active;
            if (active) {
                timeoutId = setTimeout(() => void tick(), ITEM_POLL_MS);
            }
        };

        void tick();
        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [loadItemJobs, refetchPieces]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
    const [enqueueError, setEnqueueError] = useState<string | null>(null);
    /** Peças com um "Gerar peça a partir do prompt" já enfileirado. */
    const [isGeneratingFromPrompt, setIsGeneratingFromPrompt] = useState<
        Set<string>
    >(new Set());
    /** Peças com "Reescrever prompt" já enfileirado. */
    const [isRewritingPiece, setIsRewritingPiece] = useState<Set<string>>(
        new Set()
    );
    /** Peças com "Repetir" já enfileirado (mesmo objectivo que o anterior). */
    const [isRetryingPiece, setIsRetryingPiece] = useState<Set<string>>(
        new Set()
    );
    /**
     * bumped cada vez que o modal fecha, para reler os prompts: o editor pode
     * ter gravado o prompt à mão e o "Copiar" do card copiaria o texto antigo.
     */
    const [promptRevision, setPromptRevision] = useState(0);

    const { channels } = useChannels();

    const [errors, setErrors] = useState<
        { format: ContentFormat; message: string }[]
    >([]);
    const [selectedFormats, setSelectedFormats] = useState<Set<ContentFormat>>(
        new Set(['CAROUSEL', 'LINKEDIN_POST'])
    );
    const [selectedChannels, setSelectedChannels] = useState<
        Partial<Record<ContentFormat, string>>
    >({});
    const [editingPiece, setEditingPiece] =
        useState<ContentPieceWithRelations | null>(null);
    const [isSavingModal, setIsSavingModal] = useState(false);
    // O modal pode ter gravado prompts à mão: ao fechar, relê-los para o
    // "Copiar" do card não ficar com o texto antigo. Só quando fecha — no
    // mount faria uma releitura inútil (a consulta inicial já correu).
    const wasEditingPiece = useRef(false);
    useEffect(() => {
        if (wasEditingPiece.current && !editingPiece) {
            setPromptRevision((n) => n + 1);
        }
        wasEditingPiece.current = editingPiece !== null;
    }, [editingPiece]);
    // Com o modal aberto, um "Gerar este slide" reescreve a peça na BD. O
    // `editingPiece` guardava o snapshot da abertura, por isso os campos do
    // modal ficariam com o texto antigo até fechar e reabrir. Re-deriva-se de
    // `pieces`, mas só quando o *conteúdo* muda: o modal reinicia todos os
    // campos a partir de `piece`, e qualquer outra escrita na mesma peça (subir
    // um artefacto, por exemplo, que também mexe no `updatedAt`) apagaria o
    // que o utilizador estiver a escrever. Durante um "Guardar" não há nada
    // a re-sincronizar — o snapshot que vem a seguir já é o do servidor.
    useEffect(() => {
        if (!editingPiece || isSavingModal) return;
        const fresh = pieces.find((p) => p.id === editingPiece.id);
        if (!fresh || fresh.updatedAt === editingPiece.updatedAt) return;
        const contentChanged =
            fresh.body !== editingPiece.body ||
            JSON.stringify(fresh.slides ?? null) !==
                JSON.stringify(editingPiece.slides ?? null);
        if (contentChanged) setEditingPiece(fresh);
    }, [pieces, editingPiece, isSavingModal]);
    const [preferred, setPreferred] = useState<AIProviderSelection | null>(null);
    const [additionalInstructions, setAdditionalInstructions] = useState('');

    const piecesByFormat = useMemo(() => {
        const map = new Map<ContentFormat, ContentPieceWithRelations[]>();
        pieces.forEach((piece) => {
            const existing = map.get(piece.format) || [];
            map.set(piece.format, [...existing, piece]);
        });
        return map;
    }, [pieces]);

    const toggleFormat = (format: ContentFormat) => {
        setSelectedFormats((prev) => {
            const next = new Set(prev);
            if (next.has(format)) {
                next.delete(format);
            } else {
                next.add(format);
            }
            return next;
        });
    };

    const handleChannelChange = (format: ContentFormat, channelId: string) => {
        setSelectedChannels((prev) => ({
            ...prev,
            [format]: channelId,
        }));
    };

    const getDefaultChannel = (format: ContentFormat): string => {
        const defaultChannel = CONTENT_FORMAT_DEFAULTS[format];
        const matchingChannel = channels.find(
            (c) => c.channel === defaultChannel
        );
        return matchingChannel?.id || channels[0]?.id || '';
    };

    const handleGenerate = async () => {
        if (selectedFormats.size === 0) return;

        setErrors([]);
        setEnqueueError(null);

        if (!currentWorkspace) {
            setEnqueueError('Workspace não carregado.');
            return;
        }

        const channelIds: Partial<Record<ContentFormat, string>> = {};
        for (const format of selectedFormats) {
            channelIds[format] =
                selectedChannels[format] || getDefaultChannel(format);
        }

        setIsGenerating(true);
        try {
            const result = await generationJobService.enqueue({
                workspaceId: currentWorkspace.id,
                jobType: 'CONTENT_PIECES',
                params: {
                    articleId: article.id,
                    formats: Array.from(selectedFormats),
                    channelIds,
                    productId: product?.id ?? null,
                    pillarId: pillar?.id ?? null,
                    additionalInstructions:
                        additionalInstructions.trim() || undefined,
                    preferred,
                },
            });

            rememberJob({
                jobType: 'CONTENT_PIECES',
                targetId: article.id,
                jobId: result.jobId,
            });

            // Mostra os placeholders imediatamente (o resto chega via Realtime).
            await refetchPieces();
        } catch (error) {
            setEnqueueError(
                error instanceof Error
                    ? error.message
                    : 'Erro ao agendar a geração das peças.'
            );
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGeneratePrompts = async () => {
        if (selectedFormats.size === 0) return;

        setErrors([]);
        setEnqueueError(null);

        if (!currentWorkspace) {
            setEnqueueError('Workspace não carregado.');
            return;
        }

        const channelIds: Partial<Record<ContentFormat, string>> = {};
        for (const format of selectedFormats) {
            channelIds[format] =
                selectedChannels[format] || getDefaultChannel(format);
        }

        setIsGeneratingPrompts(true);
        try {
            const result = await generationJobService.enqueue({
                workspaceId: currentWorkspace.id,
                jobType: 'CONTENT_PROMPT',
                params: {
                    articleId: article.id,
                    formats: Array.from(selectedFormats),
                    channelIds,
                    productId: product?.id ?? null,
                    pillarId: pillar?.id ?? null,
                    additionalInstructions:
                        additionalInstructions.trim() || undefined,
                    preferred,
                },
            });

            rememberJob({
                jobType: 'CONTENT_PROMPT',
                targetId: article.id,
                jobId: result.jobId,
            });

            await refetchPieces();
        } catch (error) {
            setEnqueueError(
                error instanceof Error
                    ? error.message
                    : 'Erro ao escrever os prompts das peças.'
            );
        } finally {
            setIsGeneratingPrompts(false);
        }
    };

    // Mapa pieceId → estado de geração (itens do job mais recente).
    const pieceJobs = useMemo(() => {
        const map = new Map<string, GenerationJobItem>();
        for (const item of genJob.job?.items ?? []) {
            map.set(item.targetId, item);
        }
        return map;
    }, [genJob.job]);

    // promptJobs: itemKey "slide-N" em jobs CONTENT_ITEM (regeneração de item).
    const itemJobs = useMemo(() => {
        const map = new Map<string, GenerationJobItem>();
        for (const item of promptItemJobs) {
            map.set(item.targetId, item);
        }
        return map;
    }, [promptItemJobs]);

    // Quando há um job para este artigo, refresca as peças (novos placeholders
    // no enqueue e conteúdo quando os itens concluem).
    useEffect(() => {
        if (genJob.job) {
            void refetchPieces();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [genJob.job]);

    useEffect(() => {
        if (promptJob.job) {
            void refetchPieces();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [promptJob.job]);

    // Prompt 'main' de cada peça, para os cards oferecerem Copiar / Gerar peça
    // sem obrigar a abrir o modal. Uma consulta para todas as peças.
    const [mainPrompts, setMainPrompts] = useState<
        Record<string, MainPiecePrompt>
    >({});
    useEffect(() => {
        const ids = pieceIdsKey ? pieceIdsKey.split(',') : [];
        if (ids.length === 0) {
            setMainPrompts({});
            return;
        }
        let cancelled = false;
        void getMainPromptsForPieces('PIECE', ids)
            .then((map) => {
                if (!cancelled) setMainPrompts(map);
            })
            .catch(() => {
                // Silencioso — o card só perde as acções Copiar / Gerar peça.
            });
        return () => {
            cancelled = true;
        };
        // `pieceIdsKey` (e não `pieceIds`) para não repetir a consulta sempre
        // que a lista é relida; o job de prompt traz prompts novos para peças
        // que já existem, `itemJobsKey` cobre a regeneração de um item, e
        // `promptRevision` cobre as edições feitas no modal.
    }, [
        pieceIdsKey,
        promptJob.job?.status,
        promptJob.job?.updatedAt,
        genJob.job?.updatedAt,
        itemJobsKey,
        promptRevision,
    ]);

    /**
     * "Gerar peça" a partir do prompt guardado. Peça vazia → preenche por
     * cima; peça com conteúdo → nova versão (a original fica intacta).
     */
    const handleGenerateFromPrompt = async (
        piece: ContentPieceWithRelations
    ) => {
        if (!currentWorkspace || isGeneratingFromPrompt.has(piece.id)) return;

        setEnqueueError(null);
        setIsGeneratingFromPrompt((prev) => new Set(prev).add(piece.id));
        try {
            const result = await generationJobService.enqueue({
                workspaceId: currentWorkspace.id,
                jobType: 'CONTENT_PIECES',
                params: {
                    articleId: article.id,
                    formats: [piece.format],
                    useStoredPrompt: true,
                },
                targets: [
                    {
                        format: piece.format,
                        targetId: piece.id,
                        mode: piece.body.trim() ? 'NEW_VERSION' : 'FILL',
                    },
                ],
            });
            rememberJob({
                jobType: 'CONTENT_PIECES',
                targetId: article.id,
                jobId: result.jobId,
            });
            await refetchPieces();
        } catch (error) {
            setEnqueueError(
                error instanceof Error
                    ? error.message
                    : 'Erro ao gerar a peça a partir do prompt.'
            );
        } finally {
            setIsGeneratingFromPrompt((prev) => {
                const next = new Set(prev);
                next.delete(piece.id);
                return next;
            });
        }
    };

    const handleCopyPrompt = useCallback(async (prompt: string) => {
        try {
            await navigator.clipboard.writeText(prompt);
        } catch {
            // Clipboard indisponível — o prompt continua visível no modal.
        }
    }, []);

    const handleRetryPiece = async (piece: ContentPieceWithRelations) => {
        const job = genJob.job;
        if (!currentWorkspace || !job || isRetryingPiece.has(piece.id)) return;

        setEnqueueError(null);
        setIsRetryingPiece((prev) => new Set(prev).add(piece.id));
        try {
            // "Repetir" volta a gerar a partir do contexto do artigo. O sinal
            // `useStoredPrompt` é removido de propósito: se o job anterior foi
            // um "Gerar peça a partir do prompt", repeti-lo com esse sinal
            // mandaria o modelo reproduzir o prompt em vez de escrever algo
            // novo — e o utilizador não pediu isso ao carregar em "Repetir".
            const replayed = {
                ...(job.params ?? defaultJobParams('CONTENT_PIECES')),
                useStoredPrompt: false,
            };
            const result = await generationJobService.enqueue({
                workspaceId: currentWorkspace.id,
                jobType: 'CONTENT_PIECES',
                params: replayed,
                targets: [{ format: piece.format, targetId: piece.id }],
            });
            rememberJob({
                jobType: 'CONTENT_PIECES',
                targetId: article.id,
                jobId: result.jobId,
            });
            await refetchPieces();
        } catch (error) {
            setErrors([
                {
                    format: piece.format,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Falha ao tentar novamente.',
                },
            ]);
        } finally {
            setIsRetryingPiece((prev) => {
                const next = new Set(prev);
                next.delete(piece.id);
                return next;
            });
        }
    };

    /**
     * Reescreve o prompt de uma peça (CONTENT_PROMPT com targets = a peça).
     * Só enfileira — a confirmação de prompt editado é feita por quem chama
     * (o `ContentMetaManager` já a faz para o modal; o card confirma aqui, em
     * `handleRewritePromptFromCard`).
     */
    const handleRewritePrompt = async (piece: ContentPieceWithRelations) => {
        // `promptJob.isActive` é o guard de artigo: sem ele, "Reescrever prompt"
        // em duas peças seguidas enfileirava dois CONTENT_PROMPT para o mesmo
        // artigo (o `/content` usa o mesmo critério).
        if (!currentWorkspace || isRewritingPiece.has(piece.id)) return;
        if (promptJob.isActive) return;

        setIsRewritingPiece((prev) => new Set(prev).add(piece.id));
        setEnqueueError(null);
        try {
            const result = await generationJobService.enqueue({
                workspaceId: currentWorkspace.id,
                jobType: 'CONTENT_PROMPT',
                params: {
                    articleId: article.id,
                    formats: [piece.format],
                    // O canal vem junto para o prompt reescrito ter a mesma
                    // linha "Canal: …" do prompt original desta peça.
                    channelIds: {
                        [piece.format]:
                            selectedChannels[piece.format] ||
                            getDefaultChannel(piece.format),
                    },
                    productId: product?.id ?? null,
                    pillarId: pillar?.id ?? null,
                    additionalInstructions:
                        additionalInstructions.trim() || undefined,
                    preferred,
                },
                targets: [{ format: piece.format, targetId: piece.id }],
            });
            rememberJob({
                jobType: 'CONTENT_PROMPT',
                targetId: article.id,
                jobId: result.jobId,
            });
        } catch (error) {
            setEnqueueError(
                error instanceof Error
                    ? error.message
                    : 'Erro ao reescrever o prompt.'
            );
        } finally {
            setIsRewritingPiece((prev) => {
                const next = new Set(prev);
                next.delete(piece.id);
                return next;
            });
        }
    };

    /**
     * "Reescrever prompt" a partir do card. O job substitui o prompt 'main' e
     * limpa o `editedAt`, por isso um prompt escrito à mão não pode desaparecer
     * sem confirmação.
     */
    const handleRewritePromptFromCard = async (
        piece: ContentPieceWithRelations
    ) => {
        if (mainPrompts[piece.id]?.editedAt) {
            const ok = window.confirm(
                'O prompt desta peça foi editado por ti. Ao reescrevê-lo, esse texto é substituído pelo prompt que a IA vai escrever.\n\nContinuar?'
            );
            if (!ok) return;
        }
        await handleRewritePrompt(piece);
    };

    // "Repetir" num prompt que falhou: volta a enfileirar a escrita do prompt.
    // Confirmam-se prompts editados à mão porque um job falhado NÃO apaga o
    // prompt anterior — a peça continua com o texto do utilizador e um retry
    // bem-sucedido destruiria esse texto em silêncio.
    const handleRetryPrompt = async (piece: ContentPieceWithRelations) => {
        await handleRewritePromptFromCard(piece);
    };

    const handleSavePiece = async (data: {
        title: string | null;
        body: string;
        hookText: string | null;
        ctaText: string | null;
        hashtags: string[];
        slides: { order: number; title: string; body: string }[] | null;
        channelId: string | null;
    }) => {
        if (!editingPiece) return;

        setIsSavingModal(true);
        await updatePiece(editingPiece.id, {
            title: data.title,
            body: data.body,
            hookText: data.hookText,
            ctaText: data.ctaText,
            hashtags: data.hashtags,
            slides: data.slides,
            slideCount: data.slides?.length || null,
            channelId: data.channelId,
        });
        setIsSavingModal(false);
        setEditingPiece(null);
    };

    const handleDeletePiece = async (id: string) => {
        if (confirm('Tens a certeza que queres eliminar esta peça?')) {
            await deletePiece(id);
        }
    };

    const handleApprovePiece = async (id: string) => {
        await approvePiece(id);
    };

    const groupedPieces = useMemo(() => {
        const groups: Array<{
            format: ContentFormat;
            pieces: ContentPieceWithRelations[];
        }> = [];

        for (const format of ALL_FORMATS) {
            const formatPieces = piecesByFormat.get(format);
            if (formatPieces && formatPieces.length > 0) {
                groups.push({ format, pieces: formatPieces });
            }
        }

        return groups;
    }, [piecesByFormat]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                    Selecionar formatos a gerar
                </h3>
                <div className="space-y-2">
                    {ALL_FORMATS.map((format) => {
                        const isSelected = selectedFormats.has(format);
                        const channelId =
                            selectedChannels[format] ||
                            getDefaultChannel(format);

                        return (
                            <div
                                key={format}
                                className="flex h-10 items-center gap-3 rounded-md border border-gray-200 p-3"
                            >
                                <input
                                    type="checkbox"
                                    id={`format-${format}`}
                                    checked={isSelected}
                                    onChange={() => toggleFormat(format)}
                                    disabled={isGenerating}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label
                                    htmlFor={`format-${format}`}
                                    className="flex-1 cursor-pointer text-sm"
                                >
                                    <span className="mr-2">
                                        {FORMAT_ICONS[format]}
                                    </span>
                                    {CONTENT_FORMAT_LABELS[format]}
                                </label>
                                {isSelected && (
                                    <select
                                        value={channelId}
                                        onChange={(e) =>
                                            handleChannelChange(
                                                format,
                                                e.target.value
                                            )
                                        }
                                        disabled={isGenerating}
                                        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                                    >
                                        {channels.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {CHANNEL_LABELS[c.channel]}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Provedor / Modelo
                </label>
                <AIProviderPicker
                    value={preferred}
                    onChange={setPreferred}
                    disabled={isGenerating}
                />
            </div>

            <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Instruções adicionais
                </label>
                <textarea
                    value={additionalInstructions}
                    onChange={(e) =>
                        setAdditionalInstructions(e.target.value)
                    }
                    disabled={isGenerating}
                    rows={2}
                    placeholder="Indicações extra para esta geração (opcional)..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50"
                />
            </div>

            <div className="space-y-2">
                <button
                    onClick={handleGenerate}
                    disabled={
                        isGenerating ||
                        isGeneratingPrompts ||
                        selectedFormats.size === 0 ||
                        channels.length === 0
                    }
                    className="w-full rounded-md bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                    {isGenerating ? (
                        <span className="flex items-center justify-center gap-2">
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
                            A agendar...
                        </span>
                    ) : (
                        <>Gerar {selectedFormats.size} peça(s)</>
                    )}
                </button>

                <button
                    onClick={handleGeneratePrompts}
                    disabled={
                        isGenerating ||
                        isGeneratingPrompts ||
                        selectedFormats.size === 0 ||
                        channels.length === 0
                    }
                    className="w-full rounded-md border border-purple-600 bg-white px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                >
                    {isGeneratingPrompts ? (
                        <span className="flex items-center justify-center gap-2">
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
                            A escrever os prompts...
                        </span>
                    ) : (
                        <>
                            Gerar apenas o prompt (
                            {selectedFormats.size})
                        </>
                    )}
                </button>
                <p className="text-xs text-gray-500">
                    A IA escreve o prompt de cada peça sem gerar o conteúdo.
                    Depois editas, copias ou geras a peça a partir desse prompt.
                </p>
            </div>

            {enqueueError && (
                <p className="text-xs text-red-600">{enqueueError}</p>
            )}

            {errors.map((error, index) => (
                <p key={index} className="text-xs text-red-600">
                    {error.message}
                </p>
            ))}

            {channels.length === 0 && (
                <p className="text-xs text-amber-600">
                    Configura pelo menos um canal em Settings para gerar
                    conteúdo.
                </p>
            )}

            {genJob.isActive && (
                <div className="rounded-md bg-blue-50 p-3">
                    <p className="flex items-center gap-2 text-sm text-blue-700">
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
                        A gerar as peças em segundo plano… vais vê-las aqui assim
                        que estiverem prontas.
                    </p>
                </div>
            )}

            {promptJob.isActive && (
                <div className="rounded-md bg-purple-50 p-3">
                    <p className="flex items-center gap-2 text-sm text-purple-700">
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
                        A escrever os prompts em segundo plano… abres a peça
                        para os editar.
                    </p>
                </div>
            )}

            {groupedPieces.length > 0 && (
                <div>
                    <h3 className="mb-3 text-sm font-medium text-gray-700">
                        Peças geradas
                    </h3>
                    <div className="space-y-3">
                        {groupedPieces.map(
                            ({ format, pieces: formatPieces }) => (
                                <div key={format}>
                                    <h4 className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
                                        <span>{FORMAT_ICONS[format]}</span>
                                        {CONTENT_FORMAT_LABELS[format]} (
                                        {formatPieces.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {formatPieces.map((piece) => (
                                            <ContentPieceCard
                                                key={piece.id}
                                                piece={piece}
                                                gen={pieceJobs.get(piece.id)}
                                                promptJobGen={
                                                    promptJob.job?.items?.find(
                                                        (i) =>
                                                            i.targetId ===
                                                            piece.id
                                                    ) ?? null
                                                }
                                                isItemGenerating={
                                                    itemJobs.get(piece.id)
                                                        ?.status === 'QUEUED' ||
                                                    itemJobs.get(piece.id)
                                                        ?.status === 'RUNNING'
                                                }
                                                itemGenError={
                                                    itemJobs.get(piece.id)
                                                        ?.status === 'FAILED'
                                                        ? (itemJobs.get(piece.id)
                                                              ?.error ??
                                                          'Não foi possível regenerar o item.')
                                                        : null
                                                }
                                                onEdit={() =>
                                                    setEditingPiece(piece)
                                                }
                                                onDelete={() =>
                                                    handleDeletePiece(piece.id)
                                                }
                                                onApprove={() =>
                                                    handleApprovePiece(piece.id)
                                                }
                                                onRetryPiece={() =>
                                                    handleRetryPiece(piece)
                                                }
                                                onRetryPrompt={() =>
                                                    handleRetryPrompt(piece)
                                                }
                                                onRewritePrompt={() =>
                                                    handleRewritePromptFromCard(
                                                        piece
                                                    )
                                                }
                                                mainPrompt={
                                                    mainPrompts[piece.id]
                                                }
                                                isGeneratingFromPrompt={
                                                    isGeneratingFromPrompt.has(
                                                        piece.id
                                                    )
                                                }
                                                isRewriting={
                                                    isRewritingPiece.has(
                                                        piece.id
                                                    )
                                                }
                                                isRetrying={
                                                    isRetryingPiece.has(piece.id)
                                                }
                                                isBusy={
                                                    isGenerating ||
                                                    isGeneratingPrompts
                                                }
                                                onGenerateFromPrompt={() =>
                                                    handleGenerateFromPrompt(
                                                        piece
                                                    )
                                                }
                                                onCopyPrompt={() => {
                                                    const prompt =
                                                        mainPrompts[piece.id]
                                                            ?.prompt;
                                                    if (prompt) {
                                                        void handleCopyPrompt(
                                                            prompt
                                                        );
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            <ContentPieceModal
                isOpen={!!editingPiece}
                onClose={() => setEditingPiece(null)}
                piece={editingPiece}
                onSave={handleSavePiece}
                onAssetChange={
                    editingPiece
                        ? async (data) => {
                              await updatePiece(editingPiece.id, data);
                          }
                        : undefined
                }
                onRewritePrompt={
                    editingPiece
                        ? () => handleRewritePrompt(editingPiece)
                        : undefined
                }
                isRewritingPrompt={promptJob.isActive}
                isSaving={isSavingModal}
            />
        </div>
    );
}

function ContentPieceCard({
    piece,
    gen,
    promptJobGen,
    isItemGenerating,
    itemGenError,
    mainPrompt,
    isGeneratingFromPrompt,
    isRewriting,
    isRetrying,
    isBusy,
    onEdit,
    onDelete,
    onApprove,
    onRetryPiece,
    onRetryPrompt,
    onRewritePrompt,
    onGenerateFromPrompt,
    onCopyPrompt,
}: {
    piece: ContentPieceWithRelations;
    /** Estado de geração (item do job) — null quando não há job ativo. */
    gen?: GenerationJobItem | null;
    /** Estado da escrita do prompt (CONTENT_PROMPT). */
    promptJobGen?: GenerationJobItem | null;
    /** Um item desta peça está em regeneração (CONTENT_ITEM). */
    isItemGenerating?: boolean;
    /** O último CONTENT_ITEM desta peça falhou (já não está em curso). */
    itemGenError?: string | null;
    /** Prompt 'main' guardado (undefined = ainda não há prompt). */
    mainPrompt?: MainPiecePrompt;
    /** "Gerar peça a partir do prompt" já enfileirado para esta peça. */
    isGeneratingFromPrompt?: boolean;
    /** "Reescrever prompt" já enfileirado para esta peça. */
    isRewriting?: boolean;
    /** "Repetir" já enfileirado para esta peça. */
    isRetrying?: boolean;
    /** Há algum pedido em curso no painel (desliga acções duplicadas). */
    isBusy?: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onApprove: () => void;
    onRetryPiece: () => void;
    onRetryPrompt: () => void;
    onRewritePrompt: () => void;
    onGenerateFromPrompt: () => void;
    onCopyPrompt: () => void;
}) {
    const statusColors = CONTENT_PIECE_STATUS_COLORS[piece.status];
    const isPromptReady = piece.status === 'PROMPT_READY';
    const hasContent = Boolean(piece.body && piece.body.trim());
    const hasPrompt = Boolean(mainPrompt?.prompt.trim());
    // Sem conteúdo, a peça é "só prompt": o botão escreve "Gerar peça".
    // Com conteúdo, "Gerar peça" criaria uma nova versão — a acção certa na
    // carta passa a ser abrir a peça.
    const isPromptOnly = !hasContent;
    const cardBusy = Boolean(
        isBusy || isGeneratingFromPrompt || isRewriting || isRetrying
    );

    return (
        <div
            className={`rounded-md border bg-white p-3 ${
                isPromptReady && !hasContent
                    ? 'border-amber-300 bg-amber-50/40'
                    : 'border-gray-200'
            }`}
        >
            <div className="mb-2 flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                        {hasContent
                            ? piece.title || 'Sem título'
                            : 'Só com prompt'}
                    </p>
                    {piece.channel && (
                        <div className="mt-1">
                            <ChannelBadge
                                channel={piece.channel.channel}
                                size="sm"
                            />
                        </div>
                    )}
                </div>
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                >
                    {CONTENT_PIECE_STATUS_LABELS[piece.status]}
                </span>
            </div>

            {/* Escrita do prompt em curso / falhada */}
            {promptJobGen &&
                promptJobGen.status !== 'COMPLETED' &&
                (promptJobGen.status === 'FAILED' ? (
                    <div className="mb-2 flex items-start justify-between gap-2 rounded-md bg-red-50 p-2">
                        <p className="min-w-0 flex-1 text-xs text-red-600">
                            {promptJobGen.error ||
                                'A escrita do prompt falhou.'}
                        </p>
                        <button
                            onClick={onRetryPrompt}
                            disabled={cardBusy}
                            className="shrink-0 rounded border border-red-200 bg-white px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                            Repetir
                        </button>
                    </div>
                ) : (
                    <p className="mb-2 flex items-center gap-1.5 text-xs text-purple-600">
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
                        {promptJobGen.status === 'QUEUED'
                            ? 'Na fila de escrita do prompt…'
                            : 'A escrever o prompt…'}
                    </p>
                ))}

            {isItemGenerating && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-purple-600">
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
                    A regenerar um item desta peça…
                </p>
            )}

            {itemGenError && (
                <p className="mb-2 text-xs text-red-600">{itemGenError}</p>
            )}

            {!hasContent && (
                <p className="mb-2 text-xs text-amber-700">
                    O prompt está guardado. Abre a peça para o editar, copiar ou
                    gerar o conteúdo a partir dele.
                </p>
            )}

            {gen && gen.status !== 'COMPLETED' && (
                <div className="mb-2">
                    {gen.status === 'FAILED' ? (
                        <div className="flex items-start justify-between gap-2 rounded-md bg-red-50 p-2">
                            <p className="min-w-0 flex-1 text-xs text-red-600">
                                {gen.error || 'A geração desta peça falhou.'}
                            </p>
                            <button
                                onClick={onRetryPiece}
                                disabled={cardBusy}
                                className="shrink-0 rounded border border-red-200 bg-white px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                                {isRetrying ? 'A repetir…' : 'Repetir'}
                            </button>
                        </div>
                    ) : (
                        <p className="flex items-center gap-1.5 text-xs text-blue-600">
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
                            {gen.status === 'QUEUED'
                                ? 'Na fila de geração…'
                                : 'A gerar em segundo plano…'}
                        </p>
                    )}
                </div>
            )}

            {hasContent && (
                <p className="mb-3 line-clamp-2 text-xs text-gray-500">
                    {piece.body.substring(0, 150)}
                    {piece.body.length > 150 && '...'}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {hasContent && piece.status === 'DRAFT' && (
                    <button
                        onClick={onApprove}
                        disabled={cardBusy}
                        className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                        Aprovar
                    </button>
                )}

                {/* Peça só com prompt: Ver · Copiar · Gerar peça · Reescrever */}
                {isPromptOnly && hasPrompt && (
                    <>
                        <button
                            onClick={onGenerateFromPrompt}
                            disabled={cardBusy}
                            className="rounded-md bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                            {isGeneratingFromPrompt
                                ? 'A enfileirar…'
                                : 'Gerar peça'}
                        </button>
                        <button
                            onClick={onCopyPrompt}
                            disabled={cardBusy}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Copiar
                        </button>
                    </>
                )}

                <button
                    onClick={onEdit}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                    {isPromptOnly ? 'Ver / editar prompt' : 'Editar'}
                </button>

                {/* Peça já com conteúdo: o prompt continua acessível no modal */}
                {hasContent && hasPrompt && (
                    <button
                        onClick={onEdit}
                        className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    >
                        Ver prompt
                    </button>
                )}

                {hasPrompt && (
                    <button
                        onClick={onRewritePrompt}
                        disabled={cardBusy}
                        className="rounded-md border border-purple-300 bg-white px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                    >
                        Reescrever prompt
                    </button>
                )}

                <button
                    onClick={onDelete}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                    Eliminar
                </button>
            </div>
        </div>
    );
}
