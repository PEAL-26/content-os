import type { ArticleMetadataAIState } from '@/components/articles/article-metadata-form';
import { ArticleMetadataForm } from '@/components/articles/article-metadata-form';
import type { AIProviderSelection } from '@/components/ai/ai-provider-picker';
import { ArticleStatusBadge } from '@/components/articles/article-status-badge';
import { ArtefactsPanel } from '@/components/content/artefacts-panel';
import { ContentGeneratorPanel } from '@/components/content/content-generator-panel';
import { PublicationsPanel } from '@/components/content/publications-panel';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebounce } from '@/hooks/use-debounce';
import { useGenerationJob } from '@/hooks/use-generation-job';
import {
    canGenerateMetadata,
    METADATA_FIELDS,
    METADATA_FIELD_LABELS,
    missingMetadataFields,
} from '@/lib/ai/article-metadata';
import type { MetadataField } from '@/lib/ai/generation-job-types';
import { usePillars } from '@/hooks/use-pillars';
import { useProducts } from '@/hooks/use-products';
import { cn } from '@/lib/utils';
import { workspacePath } from '@/lib/workspace-paths';
import { articleService } from '@/services/article.service';
import {
    defaultJobParams,
    generationJobService,
} from '@/services/generation-job.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useGenerationJobStore } from '@/stores/generation-jobs-store';
import {
    calculateReadingTime,
    canTransitionTo,
    STATUS_TRANSITION_LABELS,
    STATUS_TRANSITIONS,
} from '@/types/article';
import type { ArticleStatus, ArticleWithRelations } from '@/types/database';
import MDEditor from '@uiw/react-md-editor';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

const SESSION_STORAGE_KEY = 'article-editor-draft-';

interface EditorState {
    title: string;
    slug: string;
    summary: string | null;
    body: string;
    pillarId: string | null;
    productId: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    keywords: string[];
}

export function ArticleEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentWorkspace } = useWorkspaceStore();
    const workspaceId = currentWorkspace?.id ?? '';
    const { pillars } = usePillars();
    const { activeProducts } = useProducts();

    const [article, setArticle] = useState<ArticleWithRelations | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [slugError, setSlugError] = useState<string | null>(null);
    const [isCheckingSlug, setIsCheckingSlug] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showMetadata, setShowMetadata] = useState(true);
    const [reloadTick, setReloadTick] = useState(0);

    // Geração assíncrona em segundo plano (NEW_ARTICLE deste artigo).
    const rememberJob = useGenerationJobStore((s) => s.rememberJob);
    const genJob = useGenerationJob(
        id ? { kind: 'target', jobType: 'NEW_ARTICLE', targetId: id } : null
    );
    const lastReloadedJobRef = useRef<string | null>(null);

    // Geração dos metadados (ARTICLE_METADATA) deste artigo. O `items` traz um
    // estado por campo, que é o que dá spinner/erro/retry independentes.
    const metaJob = useGenerationJob(
        id ? { kind: 'target', jobType: 'ARTICLE_METADATA', targetId: id } : null
    );
    const lastMergedMetaJobRef = useRef<string | null>(null);

    const [metaPreferred, setMetaPreferred] =
        useState<AIProviderSelection | null>(null);
    const [metaInstructions, setMetaInstructions] = useState('');
    const [metaError, setMetaError] = useState<string | null>(null);
    /**
     * Enfileirou e ainda não sabe o resultado do job.
     *
     * É um estado optimista de propósito: `metaJob.isActive` só fica `true`
     * depois de o `refresh()` trazer o job novo, e nesse intervalo (um POST ao
     * enqueue + um fetch ao Supabase) o botão continuava clicável. Como o erro
     * do campo continuava preenchido (lê o job *antigo*), um segundo clique
     * enfileirava um segundo job para o mesmo artigo — dois jobs a escrever os
     * mesmos campos, com o segundo a deitar fora o primeiro.
     *
     * O ref espelha o estado para os guards poderem ler sem depender do closure.
     */
    const [isMetaEnqueuing, setIsMetaEnqueuing] = useState(false);
    const isMetaEnqueuingRef = useRef(false);
    /** true enquanto um job corre OU enquanto este enqueue está em curso. */
    const isMetaBusy = metaJob.isActive || isMetaEnqueuing;
    /** Campos a confirmar antes de sobrescrever conteúdo existente. */
    const [metaOverwriteFields, setMetaOverwriteFields] =
        useState<MetadataField[] | null>(null);

    /** Campos com erro no job actual (para o botão "Repetir" do campo). */
    const metaFieldErrors = useMemo(() => {
        const errors: Partial<Record<MetadataField, string>> = {};
        for (const item of metaJob.job?.items ?? []) {
            if (
                item.status === 'FAILED' &&
                METADATA_FIELDS.includes(item.format as MetadataField)
            ) {
                errors[item.format as MetadataField] =
                    item.error ?? 'Não foi possível gerar.';
            }
        }
        return errors;
    }, [metaJob.job]);

    /** Campos com um item em QUEUED/RUNNING (spinner por campo). */
    const metaActiveFields = useMemo(() => {
        return (metaJob.job?.items ?? [])
            .filter(
                (item) => item.status === 'QUEUED' || item.status === 'RUNNING'
            )
            .map((item) => item.format as MetadataField);
    }, [metaJob.job]);

    const [state, setState] = useState<EditorState>({
        title: '',
        slug: '',
        summary: null,
        body: '',
        pillarId: null,
        productId: null,
        seoTitle: null,
        seoDescription: null,
        keywords: [],
    });

    const pillarOptions = useMemo(() => {
        return pillars.map((p) => ({
            id: p.id,
            name: p.name,
            pillar: p.pillar,
        }));
    }, [pillars]);

    const debouncedState = useDebounce(state, 3000);

    useEffect(() => {
        if (!id) return;

        const loadArticle = async () => {
            setIsLoading(true);
            try {
                const data = await articleService.getArticleWithRelations(id);
                if (data) {
                    setArticle(data);
                    setState({
                        title: data.title,
                        slug: data.slug,
                        summary: data.summary,
                        body: data.body || '',
                        pillarId: data.pillarId,
                        productId: data.productId,
                        seoTitle: data.seoTitle,
                        seoDescription: data.seoDescription,
                        keywords: data.keywords || [],
                    });
                } else {
                    navigate(workspacePath(workspaceId, 'articles'));
                }
            } catch (err) {
                console.error('Error loading article:', err);
                navigate(workspacePath(workspaceId, 'articles'));
            } finally {
                setIsLoading(false);
            }
        };

        loadArticle();
    }, [id, navigate, workspaceId, reloadTick]);

    // Quando um job de geração deste artigo conclui, recarrega o artigo
    // (o servidor gravou o conteúdo nos placeholders).
    useEffect(() => {
        if (!genJob.job || genJob.job.status !== 'COMPLETED') return;
        if (lastReloadedJobRef.current === genJob.job.id) return;
        lastReloadedJobRef.current = genJob.job.id;
        setReloadTick((t) => t + 1);
    }, [genJob.job]);

    /**
     * ARTIGO_METADATA concluído → merge CIRÚRGICO.
     *
     * Não pode usar o `setReloadTick` do NEW_ARTICLE: aquele substitui o `state`
     * inteiro, e aqui o body pode estar a ser escrito por outro writer (o
     * utilizador a editar). Recarregar deitaria fora o que ele estiver a
     * escrever. Em vez disso relê-se o artigo e aplicam-se SÓ os 4 campos de
     * metadados — `body`, `title`, `slug`, `pillarId` e `productId` ficam
     * intactos.
     *
     * O merge não marca `hasUnsavedChanges`: os valores vêm da BD, logo o
     * estado local passa a coincidir com ela e um auto-save posterior gravaria
     * exatamente o mesmo.
     */
    useEffect(() => {
        const job = metaJob.job;
        if (!job || (job.status !== 'COMPLETED' && job.status !== 'FAILED')) {
            return;
        }
        if (lastMergedMetaJobRef.current === job.id) return;
        lastMergedMetaJobRef.current = job.id;
        if (!id) return;

        let cancelled = false;
        void (async () => {
            try {
                const fresh = await articleService.getArticleWithRelations(id);
                if (cancelled || !fresh) return;
                setState((prev) => ({
                    ...prev,
                    summary: fresh.summary,
                    keywords: fresh.keywords || [],
                    seoTitle: fresh.seoTitle,
                    seoDescription: fresh.seoDescription,
                }));
            } catch (err) {
                console.error('Erro ao ler os metadados gerados:', err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [metaJob.job, id]);

    const handleGenerationRetry = async () => {
        const job = genJob.job;
        if (!job || !id) return;

        try {
            const result = await generationJobService.enqueue({
                workspaceId: job.workspaceId,
                jobType: 'NEW_ARTICLE',
                params: job.params ?? defaultJobParams(job.jobType),
                targets:
                    job.items?.map((item) => ({
                        format: item.format,
                        targetId: item.targetId,
                    })) ?? [{ format: 'NEW_ARTICLE', targetId: id }],
            });
            rememberJob({
                jobType: 'NEW_ARTICLE',
                targetId: result.targetId,
                jobId: result.jobId,
            });
            await genJob.refresh();
        } catch (err) {
            setSaveError(
                err instanceof Error
                    ? `Falha ao tentar novamente: ${err.message}`
                    : 'Falha ao tentar novamente.'
            );
        }
    };

    useEffect(() => {
        if (!id) return;

        const savedDraft = sessionStorage.getItem(SESSION_STORAGE_KEY + id);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft) as EditorState;
                if (draft.body && draft.body !== state.body) {
                    setState((prev) => ({ ...prev, body: draft.body }));
                    setHasUnsavedChanges(true);
                }
            } catch {
                sessionStorage.removeItem(SESSION_STORAGE_KEY + id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- state.body intentionally omitted
    }, [id]);

    useEffect(() => {
        if (!id || !hasUnsavedChanges) return;

        sessionStorage.setItem(
            SESSION_STORAGE_KEY + id,
            JSON.stringify({
                body: state.body,
            })
        );
    }, [state.body, id, hasUnsavedChanges]);

    const checkSlugExists = useCallback(
        async (slug: string, excludeId?: string) => {
            if (!currentWorkspace?.id) return false;

            setIsCheckingSlug(true);
            setSlugError(null);

            try {
                const articles = await articleService.getArticles(
                    currentWorkspace.id,
                    { search: slug }
                );
                const exists = articles.some(
                    (a) => a.slug === slug && a.id !== excludeId
                );

                if (exists) {
                    setSlugError(
                        'Este slug já está a ser usado por outro artigo'
                    );
                    return true;
                }

                setSlugError(null);
                return false;
            } catch (err) {
                console.error('Error checking slug:', err);
                return false;
            } finally {
                setIsCheckingSlug(false);
            }
        },
        [currentWorkspace?.id]
    );

    const saveArticle = useCallback(async () => {
        if (!id || !currentWorkspace?.id || slugError) return;

        setIsSaving(true);
        setSaveError(null);

        try {
            // Enquanto um ARTICLE_METADATA corre, os 4 campos de metadados são
            // OMITIDOS do payload. Sem isto, o debounce de 3s dispara com os
            // valores antigos em memória e re-escreve por cima do que o job
            // acabou de gravar na BD — o resultado da IA perdia-se em silêncio.
            // É uma janela real: o job escreve aos ~6s e o auto-save aos ~7s.
            const skipMetadata = metaJob.isActive;

            await articleService.updateArticle(id, {
                title: state.title,
                slug: state.slug,
                body: state.body,
                pillarId: state.pillarId,
                productId: state.productId,
                ...(skipMetadata
                    ? {}
                    : {
                          summary: state.summary,
                          seoTitle: state.seoTitle,
                          seoDescription: state.seoDescription,
                          keywords: state.keywords,
                      }),
            });

            sessionStorage.removeItem(SESSION_STORAGE_KEY + id);
            setLastSaved(new Date());
            setHasUnsavedChanges(false);
        } catch (err) {
            console.error('Error saving article:', err);
            setSaveError(
                err instanceof Error ? err.message : 'Erro ao guardar'
            );
        } finally {
            setIsSaving(false);
        }
    }, [id, currentWorkspace?.id, slugError, state, metaJob.isActive]);

    useEffect(() => {
        if (!hasUnsavedChanges || !id || slugError) return;

        const timer = setTimeout(() => {
            saveArticle();
        }, 3000);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- id and slugError intentionally omitted
    }, [debouncedState, hasUnsavedChanges, saveArticle]);

    const handleUpdateState = (updates: Partial<EditorState>) => {
        setState((prev) => ({ ...prev, ...updates }));
        setHasUnsavedChanges(true);
    };

    const handleSlugBlur = () => {
        if (state.slug && article) {
            checkSlugExists(state.slug, article.id);
        }
    };

    // -----------------------------------------------------------------------
    // ARTICLE_METADATA — por campo e global
    // -----------------------------------------------------------------------

    /**
     * Pedido ao servidor. Como o enqueue de ARTICLE_METADATA não aceita `targets`
     * (não há placeholder — o artigo já existe), o "Repetir" de um campo é um
     * pedido NOVO com `fields: [esse campo]`, o que refaz só esse campo.
     */
    const requestMetadata = useCallback(
        async (fields: MetadataField[]) => {
            if (!currentWorkspace || !id || fields.length === 0) return;

            // Optimista: liga ANTES do await para cobrir o clique seguinte, e
            // desliga no `finally` para o botão voltar a ficar disponível se o
            // enqueue falhar.
            isMetaEnqueuingRef.current = true;
            setIsMetaEnqueuing(true);
            setMetaError(null);
            try {
                const result = await generationJobService.enqueue({
                    workspaceId: currentWorkspace.id,
                    jobType: 'ARTICLE_METADATA',
                    params: {
                        articleId: id,
                        fields,
                        additionalInstructions:
                            metaInstructions.trim() || undefined,
                        preferred: metaPreferred,
                    },
                });
                rememberJob({
                    jobType: 'ARTICLE_METADATA',
                    targetId: id,
                    jobId: result.jobId,
                });
                await metaJob.refresh();
            } catch (err) {
                const e = err as { message?: string };
                setMetaError(e.message ?? 'Erro ao agendar a geração.');
            } finally {
                isMetaEnqueuingRef.current = false;
                setIsMetaEnqueuing(false);
            }
        },
        // `metaJob.refresh` é estável (useCallback sem deps); `metaJob` em si
        // mudaria de identidade a cada render e re-criaria estes handlers.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            currentWorkspace,
            id,
            metaInstructions,
            metaPreferred,
            rememberJob,
            metaJob.refresh,
        ]
    );

    const handleGenerateMetadata = useCallback(
        (fields: MetadataField[]) => {
            // O ref fecha a janela entre o clique e o `refresh()`: durante o
            // enqueue o `metaJob.isActive` ainda é false e o `disabled` sozinho
            // não chega.
            if (
                !currentWorkspace ||
                metaJob.isActive ||
                isMetaEnqueuingRef.current ||
                fields.length === 0
            ) {
                return;
            }
            if (!canGenerateMetadata(state.body)) return;

            // Só pede confirmação o que vai SUBSTITUIR trabalho do utilizador.
            // "Gerar em falta" nunca chega aqui com campo preenchido (por
            // construção), por isso o caminho comum não abre modal nenhum.
            const missing = missingMetadataFields(state);
            const filled = fields.filter((f) => !missing.includes(f));

            if (filled.length > 0) {
                setMetaOverwriteFields(fields);
                return;
            }
            void requestMetadata(fields);
        },
        [currentWorkspace, metaJob.isActive, state, requestMetadata]
    );

    const handleConfirmOverwrite = useCallback(() => {
        const fields = metaOverwriteFields;
        setMetaOverwriteFields(null);
        if (fields) void requestMetadata(fields);
    }, [metaOverwriteFields, requestMetadata]);

    /** Repete um campo que falhou — só ele. */
    const handleRetryMetaField = useCallback(
        (field: MetadataField) => {
            if (!currentWorkspace || metaJob.isActive) return;
            void requestMetadata([field]);
        },
        [currentWorkspace, metaJob.isActive, requestMetadata]
    );

    /**
     * Estado de geração dos metadados que vai para o formulário. Só existe se
     * o artigo já tem corpo — sem texto não há nada a derivar, e os botões
     * desligam-se com a explicação em vez de mostrarem um erro ao clicar.
     */
    const metadataAIState: ArticleMetadataAIState | undefined = article
        ? {
              isBusy: metaJob.isActive,
              activeFields: metaActiveFields,
              fieldErrors: metaFieldErrors,
              missingFields: missingMetadataFields(state),
              canGenerate: canGenerateMetadata(state.body),
              preferred: metaPreferred,
              onPreferredChange: setMetaPreferred,
              additionalInstructions: metaInstructions,
              onAdditionalInstructionsChange: setMetaInstructions,
              onGenerate: handleGenerateMetadata,
              onRetryField: handleRetryMetaField,
          }
        : undefined;

    const handleStatusChange = async (newStatus: ArticleStatus) => {
        if (!id || !article) return;

        if (!canTransitionTo(article.status, newStatus)) {
            return;
        }

        setIsSaving(true);
        try {
            await articleService.updateStatus(id, newStatus);
            setArticle((prev) =>
                prev ? { ...prev, status: newStatus } : null
            );
        } catch (err) {
            console.error('Error updating status:', err);
            setSaveError(
                err instanceof Error ? err.message : 'Erro ao atualizar status'
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveNow = () => {
        saveArticle();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        );
    }

    if (!article) {
        return (
            <div className="py-12 text-center">
                <p className="text-gray-500">Artigo não encontrado</p>
                <Link
                    to={workspacePath(workspaceId, 'articles')}
                    className="mt-2 text-blue-600 hover:underline"
                >
                    Voltar à lista
                </Link>
            </div>
        );
    }

    const availableTransitions = STATUS_TRANSITIONS[article.status] || [];

    const readingTime = calculateReadingTime(state.body);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-4">
                    <Link
                        to={workspacePath(workspaceId, 'articles')}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
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
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                        Artigos
                    </Link>
                    <span className="text-gray-300">/</span>
                    <h1 className="max-w-md truncate text-lg font-semibold text-gray-900">
                        {state.title || 'Sem título'}
                    </h1>
                    <ArticleStatusBadge status={article.status} />
                </div>

                <div className="flex items-center gap-4">
                    {lastSaved && (
                        <span className="text-xs text-gray-400">
                            Guardado às {lastSaved.toLocaleTimeString('pt-PT')}
                        </span>
                    )}
                    {hasUnsavedChanges && (
                        <span className="text-xs text-amber-600">
                            Alterações não guardadas
                        </span>
                    )}
                    <button
                        onClick={handleSaveNow}
                        disabled={isSaving || !hasUnsavedChanges || !!slugError}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
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
                                A guardar...
                            </>
                        ) : (
                            'Guardar'
                        )}
                    </button>
                </div>
            </div>

            {saveError && (
                <div className="mx-6 mt-4 rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-700">{saveError}</p>
                </div>
            )}

            {genJob.job && genJob.job.status !== 'COMPLETED' && (
                <GenerationStatusBanner
                    status={genJob.job.status}
                    error={genJob.job.error}
                    onRetry={handleGenerationRetry}
                />
            )}

            {metaJob.isActive && (
                <div className="mx-6 mt-4 flex items-center gap-3 rounded-md border border-purple-200 bg-purple-50 p-3">
                    <svg
                        className="h-5 w-5 shrink-0 animate-spin text-purple-500"
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
                    <p className="text-sm text-purple-700">
                        A gerar os metadados em segundo plano… aparecem nos
                        campos assim que estiverem prontos.
                    </p>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                <div
                    className={cn(
                        'transaition-all flex flex-col border-r border-b border-l',
                        showMetadata ? 'w-[70%]' : 'w-full'
                    )}
                >
                    <div className="flex h-12 items-center justify-between border-b px-4 py-2">
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500">
                                {readingTime} min de leitura
                            </span>
                            <span className="text-xs text-gray-500">
                                {state.body.split(/\s+/).filter(Boolean).length}{' '}
                                palavras
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            {availableTransitions.length > 0 && (
                                <div className="flex items-center gap-2">
                                    {availableTransitions.map((status) => (
                                        <button
                                            key={`transition-${status}`}
                                            onClick={() =>
                                                handleStatusChange(status)
                                            }
                                            disabled={isSaving}
                                            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            {STATUS_TRANSITION_LABELS[status]}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={() => setShowMetadata((prev) => !prev)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                title="Ocultar metadados"
                            >
                                {showMetadata ? (
                                    <PanelLeftOpen className="h-4 w-4" />
                                ) : (
                                    <PanelLeftClose className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="min-h-[calc(100vh-162px)] flex-1 overflow-auto p-4">
                        <MDEditor
                            value={state.body}
                            onChange={(value) =>
                                handleUpdateState({ body: value || '' })
                            }
                            height="100%"
                            preview="edit"
                            data-color-mode="light"
                        />
                    </div>
                </div>

                {showMetadata && (
                    <div className="w-[30%] overflow-y-auto border-r border-b bg-gray-50">
                        <Tabs
                            defaultValue="metadata"
                            className="flex h-full flex-col"
                        >
                            <TabsList className="h-12 w-full justify-start rounded-none border-b bg-gray-50 px-4">
                                <TabsTrigger value="metadata">
                                    Metadados
                                </TabsTrigger>
                                <TabsTrigger value="content">
                                    Conteúdo
                                </TabsTrigger>
                                <TabsTrigger value="assets">
                                    Artefactos e publicações
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent
                                value="metadata"
                                className="flex-1 overflow-y-auto p-4"
                            >
                                <ArticleMetadataForm
                                    metadata={state}
                                    onChange={handleUpdateState}
                                    pillars={pillarOptions}
                                    slugError={slugError}
                                    onSlugBlur={handleSlugBlur}
                                    isCheckingSlug={isCheckingSlug}
                                    ai={metadataAIState}
                                />
                                {metaError && (
                                    <p className="mt-3 text-xs text-red-600">
                                        {metaError}
                                    </p>
                                )}
                            </TabsContent>

                            <TabsContent
                                value="content"
                                className="flex-1 overflow-y-auto p-4"
                            >
                                <ContentGeneratorPanel
                                    article={article}
                                    product={activeProducts.find(
                                        (p) => p.id === state.productId
                                    )}
                                    pillar={pillars.find(
                                        (p) => p.id === state.pillarId
                                    )}
                                />
                            </TabsContent>

                            {/* Artefactos e publicações do artigo. O painel
                                carrega os seus próprios dados. */}
                            <TabsContent
                                value="assets"
                                className="flex-1 space-y-5 overflow-y-auto p-4"
                            >
                                <ArtefactsPanel
                                    targetType="ARTICLE"
                                    targetId={article.id}
                                />
                                <PublicationsPanel
                                    targetType="ARTICLE"
                                    targetId={article.id}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </div>

            {/* Confirmação de sobrescrita: só aparece no caminho que substitui
                conteúdo já escrito por mão. */}
            <ConfirmModal
                isOpen={metaOverwriteFields !== null}
                onClose={() => setMetaOverwriteFields(null)}
                onConfirm={handleConfirmOverwrite}
                title="Substituir metadados?"
                message={
                    metaOverwriteFields
                        ? `A IA vai substituir o conteúdo de: ${metaOverwriteFields
                              .map((f) => METADATA_FIELD_LABELS[f])
                              .join(', ')}. O texto do artigo e o resto dos campos não são tocados.`
                        : ''
                }
                confirmText="Substituir"
                variant="warning"
            />
        </div>
    );
}

// -----------------------------------------------------------------------------
// Banner de estado da geração em segundo plano (NEW_ARTICLE)
// -----------------------------------------------------------------------------

function GenerationStatusBanner({
    status,
    error,
    onRetry,
}: {
    status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    error: string | null;
    onRetry: () => void;
}) {
    if (status === 'FAILED') {
        return (
            <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 p-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-red-700">
                            A geração deste artigo falhou
                        </p>
                        <p className="mt-0.5 text-xs text-red-600">
                            {error || 'Erro desconhecido'}
                        </p>
                    </div>
                    <button
                        onClick={onRetry}
                        className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                    >
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-3">
            <svg
                className="h-5 w-5 shrink-0 animate-spin text-blue-500"
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
            <p className="text-sm text-blue-700">
                A gerar artigo em segundo plano… o conteúdo aparece aqui assim
                que estiver pronto.
            </p>
        </div>
    );
}
