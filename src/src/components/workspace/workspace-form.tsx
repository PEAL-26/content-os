import {
    createWorkspaceSchema,
    LANGUAGE_OPTIONS,
    SECTOR_OPTIONS,
    type CreateWorkspaceFormData,
} from '@/lib/schemas/workspace';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Tipos do formulário de workspace.
 * - WorkspaceFormValues: valores de entrada (contentLanguage/valueRatio
 *   ficam opcionais porque o schema define .default()).
 * - CreateWorkspaceFormData: valores resolvidos (após aplicar os defaults).
 */
export type WorkspaceFormValues = z.input<typeof createWorkspaceSchema>;

/**
 * Setup partilhado do formulário de workspace (criar/editar).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceForm(
    defaultValues?: Partial<WorkspaceFormValues>
) {
    return useForm<WorkspaceFormValues, unknown, CreateWorkspaceFormData>({
        resolver: zodResolver(createWorkspaceSchema),
        defaultValues: {
            contentLanguage: 'pt',
            valueRatio: 70,
            ...defaultValues,
        },
    });
}

/**
 * Campos do formulário de workspace. Deve ser usado dentro de um <form>
 * e renderiza o grid completo de campos (nome, sector, website, idioma,
 * rácio valor/produto, etc.).
 */
export function WorkspaceFormFields({
    form,
}: {
    form: UseFormReturn<
        WorkspaceFormValues,
        unknown,
        CreateWorkspaceFormData
    >;
}) {
    const { errors } = form.formState;

    const valueRatio = form.watch('valueRatio');

    return (
        <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
                <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                >
                    Nome da empresa *
                </label>
                <input
                    {...form.register('name')}
                    type="text"
                    id="name"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="Minha Empresa Lda"
                />
                {errors.name && (
                    <p className="mt-1 text-sm text-red-600">
                        {errors.name.message}
                    </p>
                )}
            </div>

            <div>
                <label
                    htmlFor="sector"
                    className="block text-sm font-medium text-gray-700"
                >
                    Sector *
                </label>
                <select
                    {...form.register('sector')}
                    id="sector"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                >
                    <option value="">Selecione um sector</option>
                    {SECTOR_OPTIONS.map((sector) => (
                        <option key={sector} value={sector}>
                            {sector}
                        </option>
                    ))}
                </select>
                {errors.sector && (
                    <p className="mt-1 text-sm text-red-600">
                        {errors.sector.message}
                    </p>
                )}
            </div>

            <div>
                <label
                    htmlFor="website"
                    className="block text-sm font-medium text-gray-700"
                >
                    Website
                </label>
                <input
                    {...form.register('website')}
                    type="url"
                    id="website"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="https://empresa.com"
                />
                {errors.website && (
                    <p className="mt-1 text-sm text-red-600">
                        {errors.website.message}
                    </p>
                )}
            </div>

            <div className="sm:col-span-2">
                <label
                    htmlFor="targetAudience"
                    className="block text-sm font-medium text-gray-700"
                >
                    Público-alvo
                </label>
                <textarea
                    {...form.register('targetAudience')}
                    id="targetAudience"
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="PMEs angolanas, Startups B2B, etc."
                />
                {errors.targetAudience && (
                    <p className="mt-1 text-sm text-red-600">
                        {errors.targetAudience.message}
                    </p>
                )}
            </div>

            <div className="sm:col-span-2">
                <label
                    htmlFor="valueProposition"
                    className="block text-sm font-medium text-gray-700"
                >
                    Proposta de valor
                </label>
                <textarea
                    {...form.register('valueProposition')}
                    id="valueProposition"
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="O que torna a sua empresa única? Que problema resolve?"
                />
                {errors.valueProposition && (
                    <p className="mt-1 text-sm text-red-600">
                        {errors.valueProposition.message}
                    </p>
                )}
            </div>

            <div className="sm:col-span-2">
                <label
                    htmlFor="voiceTone"
                    className="block text-sm font-medium text-gray-700"
                >
                    Tom de voz
                </label>
                <textarea
                    {...form.register('voiceTone')}
                    id="voiceTone"
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="directo e técnico, casual mas profissional, etc."
                />
                {errors.voiceTone && (
                    <p className="mt-1 text-sm text-red-600">
                        {errors.voiceTone.message}
                    </p>
                )}
            </div>

            <div>
                <label
                    htmlFor="contentLanguage"
                    className="block text-sm font-medium text-gray-700"
                >
                    Idioma do conteúdo
                </label>
                <select
                    {...form.register('contentLanguage')}
                    id="contentLanguage"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                >
                    {LANGUAGE_OPTIONS.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                            {lang.label}
                        </option>
                    ))}
                </select>
                {errors.contentLanguage && (
                    <p className="mt-1 text-sm text-red-600">
                        {errors.contentLanguage.message}
                    </p>
                )}
            </div>

            <div>
                <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700"
                >
                    Descrição
                </label>
                <textarea
                    {...form.register('description')}
                    id="description"
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="Breve descrição da empresa"
                />
                {errors.description && (
                    <p className="mt-1 text-sm text-red-600">
                        {errors.description.message}
                    </p>
                )}
            </div>

            <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                    Rácio Valor / Produto
                </label>
                <p className="mt-1 text-xs text-gray-500">
                    Defina a proporção de conteúdo de valor (educativo) vs.
                    conteúdo de produto (promocional)
                </p>

                <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-4">
                        <span className="w-20 text-sm text-gray-600">
                            Valor ({valueRatio}%)
                        </span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            {...form.register('valueRatio', {
                                valueAsNumber: true,
                            })}
                            className="flex-1"
                        />
                        <span className="w-20 text-sm text-gray-600">
                            Produto ({100 - (valueRatio ?? 70)}%)
                        </span>
                    </div>

                    <div className="flex h-3 overflow-hidden rounded-full bg-gray-200">
                        <div
                            className="bg-blue-500 transition-all duration-200"
                            style={{ width: `${valueRatio ?? 70}%` }}
                        />
                        <div
                            className="bg-purple-500 transition-all duration-200"
                            style={{
                                width: `${100 - (valueRatio ?? 70)}%`,
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}