import { ArticleMetadataForm } from '@/components/articles/article-metadata-form';
import { ArticleStatusBadge } from '@/components/articles/article-status-badge';
import { ContentGeneratorPanel } from '@/components/content/content-generator-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebounce } from '@/hooks/use-debounce';
import { usePillars } from '@/hooks/use-pillars';
import { useProducts } from '@/hooks/use-products';
import { cn } from '@/lib/utils';
import { articleService } from '@/services/article.service';
import { useWorkspaceStore } from '@/stores/workspace-store';
import {
    calculateReadingTime,
    canTransitionTo,
    STATUS_TRANSITION_LABELS,
    STATUS_TRANSITIONS,
} from '@/types/article';
import type { ArticleStatus, ArticleWithRelations } from '@/types/database';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
                    navigate('/dashboard/articles');
                }
            } catch (err) {
                console.error('Error loading article:', err);
                navigate('/dashboard/articles');
            } finally {
                setIsLoading(false);
            }
        };

        loadArticle();
    }, [id, navigate]);

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
            await articleService.updateArticle(id, {
                title: state.title,
                slug: state.slug,
                summary: state.summary,
                body: state.body,
                pillarId: state.pillarId,
                productId: state.productId,
                seoTitle: state.seoTitle,
                seoDescription: state.seoDescription,
                keywords: state.keywords,
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
    }, [id, currentWorkspace?.id, slugError, state]);

    useEffect(() => {
        if (!hasUnsavedChanges || !id || slugError) return;

        const timer = setTimeout(() => {
            saveArticle();
        }, 3000);

        return () => clearTimeout(timer);
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
                    to="/dashboard/articles"
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
                        to="/dashboard/articles"
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
                                />
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
                        </Tabs>
                    </div>
                )}
            </div>
        </div>
    );
}

import MDEditor from '@uiw/react-md-editor';
