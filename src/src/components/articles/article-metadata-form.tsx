import { MetadataGenerateButton } from '@/components/articles/metadata-generate-button';
import { MetadataGenerationOptions } from '@/components/articles/metadata-generation-options';
import type { AIProviderSelection } from '@/components/ai/ai-provider-picker';
import { PillarBadge } from '@/components/content/pillar-badge';
import { ProductSelector } from '@/components/products/product-selector';
import {
    METADATA_FIELDS as ALL_FIELDS,
    type ArticleMetadataValues,
} from '@/lib/ai/article-metadata';
import type { MetadataField } from '@/lib/ai/generation-job-types';
import { generateSlug } from '@/types/article';
import type { ContentPillar } from '@/types/pillar';
import { PlusIcon } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useState } from 'react';

interface ArticleMetadata extends ArticleMetadataValues {
    title: string;
    slug: string;
    pillarId: string | null;
    productId: string | null;
}

/**
 * Estado da geração de metadados que o editor passa para o formulário.
 *
 * Vai como UM objecto (`ai`) em vez de seis props soltas: o formulário continua
 * controlado e burro, e a forma de dizer "o painel tem geração de IA" é uma
 * só. `onGenerate` recebe a lista de campos, porque os dois botões globais
 * geram vários de uma vez.
 */
export interface ArticleMetadataAIState {
    /** Há um ARTICLE_METADATA activo (desliga todos os botões). */
    isBusy: boolean;
    /** Campos a gerar neste momento (para o spinner por campo). */
    activeFields: MetadataField[];
    /** Erro por campo do último job. */
    fieldErrors: Partial<Record<MetadataField, string>>;
    /** Campos sem conteúdo (usado pelo contador do botão global). */
    missingFields: MetadataField[];
    /** Sem body não há o que derivar — desliga a geração toda. */
    canGenerate: boolean;
    preferred: AIProviderSelection | null;
    onPreferredChange: (value: AIProviderSelection | null) => void;
    additionalInstructions: string;
    onAdditionalInstructionsChange: (value: string) => void;
    /** Gera os campos indicados (1 no botão por campo, N nos globais). */
    onGenerate: (fields: MetadataField[]) => void;
    /** Repete um campo que falhou. */
    onRetryField: (field: MetadataField) => void;
}

interface ArticleMetadataFormProps {
    metadata: ArticleMetadata;
    onChange: (updates: Partial<ArticleMetadata>) => void;
    pillars: Array<{ id: string; name: string; pillar: string }>;
    slugError?: string | null;
    onSlugBlur?: () => void;
    isCheckingSlug?: boolean;
    ai?: ArticleMetadataAIState;
}

/** Linha `label` + acção à direita — base de todos os campos com botão. */
function FieldHeader({
    label,
    hint,
    action,
}: {
    label: ReactNode;
    hint?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">
                {label}
                {hint && (
                    <span className="ml-1 text-xs font-normal text-gray-500">
                        {hint}
                    </span>
                )}
            </label>
            {action}
        </div>
    );
}

export function ArticleMetadataForm({
    metadata,
    onChange,
    pillars,
    slugError,
    onSlugBlur,
    isCheckingSlug,
    ai,
}: ArticleMetadataFormProps) {
    const [keywordInput, setKeywordInput] = useState('');

    const handleAddKeyword = () => {
        const trimmed = keywordInput.trim();
        if (trimmed && !metadata.keywords.includes(trimmed)) {
            onChange({ keywords: [...metadata.keywords, trimmed] });
            setKeywordInput('');
        }
    };

    const handleKeywordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddKeyword();
        }
    };

    const handleRemoveKeyword = (keyword: string) => {
        onChange({ keywords: metadata.keywords.filter((k) => k !== keyword) });
    };

    const handleRegenerateSlug = () => {
        onChange({ slug: generateSlug(metadata.title) });
    };

    const pillar = pillars.find((p) => p.id === metadata.pillarId);

    /** Botão de geração do campo, ou null quando não há geração configurada. */
    const generateAction = (field: MetadataField) => {
        if (!ai) return null;
        return (
            <MetadataGenerateButton
                field={field}
                isGenerating={ai.activeFields.includes(field)}
                isBusy={ai.isBusy}
                error={ai.fieldErrors[field]}
                onGenerate={(f) => ai.onGenerate([f])}
                onRetry={ai.onRetryField}
            />
        );
    };

    const hasContentField =
        ai?.missingFields.some((f) => f !== 'keywords') ?? false;

    return (
        <div className="space-y-5">
            {ai && (
                <div className="space-y-2">
                    <MetadataGenerationOptions
                        preferred={ai.preferred}
                        onPreferredChange={ai.onPreferredChange}
                        additionalInstructions={ai.additionalInstructions}
                        onAdditionalInstructionsChange={
                            ai.onAdditionalInstructionsChange
                        }
                        disabled={ai.isBusy}
                    />

                    <button
                        type="button"
                        onClick={() => ai.onGenerate(ai.missingFields)}
                        disabled={
                            ai.isBusy ||
                            !ai.canGenerate ||
                            ai.missingFields.length === 0
                        }
                        title={
                            !ai.canGenerate
                                ? 'Escreve o artigo primeiro — os metadados são derivados do texto.'
                                : undefined
                        }
                        className="w-full rounded-md bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {ai.missingFields.length === 0
                            ? 'Metadados completos'
                            : `Gerar em falta (${ai.missingFields.length})`}
                    </button>

                    {/* "Regenerar todos" só existe quando há conteúdo a
                        substituir — caso contrário seria um botão que só
                        reescreve o que a IA acabou de escrever. */}
                    {hasContentField && (
                        <button
                            type="button"
                            onClick={() => ai.onGenerate(ALL_FIELDS)}
                            disabled={ai.isBusy || !ai.canGenerate}
                            className="w-full rounded-md border border-purple-600 bg-white px-4 py-2.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                        >
                            Regenerar todos
                        </button>
                    )}

                    {!ai.canGenerate && (
                        <p className="text-xs text-amber-600">
                            Escreve o artigo primeiro — os metadados são
                            derivados do texto.
                        </p>
                    )}
                </div>
            )}
            <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Título
                </label>
                <input
                    type="text"
                    value={metadata.title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    placeholder="Título do artigo"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
            </div>

            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                        Slug (URL)
                    </label>
                    <button
                        type="button"
                        onClick={handleRegenerateSlug}
                        className="text-xs text-blue-600 hover:text-blue-700"
                    >
                        Regenerar do título
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={metadata.slug}
                        onChange={(e) =>
                            onChange({
                                slug: e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9-]/g, ''),
                            })
                        }
                        onBlur={onSlugBlur}
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    {isCheckingSlug && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                    )}
                </div>
                {slugError && (
                    <p className="mt-1 text-xs text-red-600">{slugError}</p>
                )}
            </div>

            <div>
                <FieldHeader
                    label="Resumo"
                    action={generateAction('summary')}
                />
                <textarea
                    value={metadata.summary || ''}
                    onChange={(e) =>
                        onChange({ summary: e.target.value || null })
                    }
                    placeholder="Breve descrição do artigo (opcional)"
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
            </div>

            <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Pilar de conteúdo
                </label>
                <select
                    value={metadata.pillarId || ''}
                    onChange={(e) =>
                        onChange({ pillarId: e.target.value || null })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                    <option value="">Selecionar pilar (opcional)</option>
                    {pillars.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
                {pillar && (
                    <div className="mt-2">
                        <PillarBadge pillar={pillar.pillar as ContentPillar} size="sm" />
                    </div>
                )}
            </div>

            <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Produto relacionado
                </label>
                <ProductSelector
                    value={metadata.productId}
                    onChange={(id) => onChange({ productId: id })}
                    placeholder="Selecionar produto (opcional)"
                    className="w-full"
                />
            </div>

            <div>
                <FieldHeader
                    label="Keywords"
                    action={generateAction('keywords')}
                />
                <div className="flex flex-wrap gap-2">
                    {metadata.keywords.map((keyword) => (
                        <span
                            key={keyword}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                        >
                            {keyword}
                            <button
                                type="button"
                                onClick={() => handleRemoveKeyword(keyword)}
                                className="ml-0.5 text-gray-500 hover:text-gray-700"
                            >
                                <svg
                                    className="h-3 w-3"
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
                        </span>
                    ))}
                </div>
                <div className="mt-2 flex gap-2">
                    <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={handleKeywordKeyDown}
                        placeholder="Adicionar keyword e pressionar Enter"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={handleAddKeyword}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <PlusIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="border-t pt-5">
                <h4 className="mb-3 text-sm font-medium text-gray-700">SEO</h4>
                <div className="space-y-4">
                    <div>
                        <FieldHeader
                            label={
                                <>
                                    Meta Title (
                                    {metadata.seoTitle?.length || 0}/60)
                                </>
                            }
                            action={generateAction('seoTitle')}
                        />
                        <input
                            type="text"
                            value={metadata.seoTitle || ''}
                            onChange={(e) =>
                                onChange({ seoTitle: e.target.value || null })
                            }
                            placeholder="Título para SEO (opcional)"
                            maxLength={60}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <FieldHeader
                            label={
                                <>
                                    Meta Description (
                                    {metadata.seoDescription?.length || 0}/160)
                                </>
                            }
                            action={generateAction('seoDescription')}
                        />
                        <textarea
                            value={metadata.seoDescription || ''}
                            onChange={(e) =>
                                onChange({
                                    seoDescription: e.target.value || null,
                                })
                            }
                            placeholder="Descrição para SEO (opcional)"
                            rows={2}
                            maxLength={160}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
