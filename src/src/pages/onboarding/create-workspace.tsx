import { useAuthContext } from '@/context/auth-context'
import { useWorkspace } from '@/hooks/use-workspace'
import {
    createWorkspaceSchema,
    LANGUAGE_OPTIONS,
    SECTOR_OPTIONS,
    type CreateWorkspaceFormData,
} from '@/lib/schemas/workspace'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

export function CreateWorkspacePage() {
    const navigate = useNavigate()
    const { user } = useAuthContext()
    const { createWorkspace, isLoading, error, currentWorkspace } =
        useWorkspace()

    useEffect(() => {
        if (currentWorkspace) {
            navigate('/dashboard', { replace: true })
        }
    }, [currentWorkspace, navigate])

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(createWorkspaceSchema),
        defaultValues: {
            contentLanguage: 'pt',
            valueRatio: 70,
        },
    })

    const valueRatio = watch('valueRatio')

    const onSubmit = async (data: unknown) => {
        if (!user) return

        const formData = data as CreateWorkspaceFormData

        const result = await createWorkspace(user.id, {
            name: formData.name,
            description: formData.description,
            sector: formData.sector,
            website: formData.website || undefined,
            voiceTone: formData.voiceTone,
            targetAudience: formData.targetAudience,
            valueProposition: formData.valueProposition,
            contentLanguage: formData.contentLanguage,
            valueRatio: formData.valueRatio,
            productRatio: 100 - (formData.valueRatio ?? 70),
        })

        if (result.success) {
            navigate('/dashboard', { replace: true })
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
            <div className="w-full max-w-2xl">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Configurar Workspace
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Configure o seu espaço de trabalho para começar a criar
                        conteúdo
                    </p>
                </div>

                <div className="mt-8 bg-white px-6 py-8 shadow-xl ring-1 ring-gray-900/5 sm:px-8">
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <div className="grid gap-6 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label
                                    htmlFor="name"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Nome da empresa *
                                </label>
                                <input
                                    {...register('name')}
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
                                    {...register('sector')}
                                    id="sector"
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                                >
                                    <option value="">
                                        Selecione um sector
                                    </option>
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
                                    {...register('website')}
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
                                    {...register('targetAudience')}
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
                                    {...register('valueProposition')}
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
                                    {...register('voiceTone')}
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
                                    {...register('contentLanguage')}
                                    id="contentLanguage"
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:text-sm"
                                >
                                    {LANGUAGE_OPTIONS.map((lang) => (
                                        <option
                                            key={lang.value}
                                            value={lang.value}
                                        >
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
                                    {...register('description')}
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
                                    Defina a proporção de conteúdo de valor
                                    (educativo) vs. conteúdo de produto
                                    (promocional)
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
                                            {...register('valueRatio', {
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

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex w-full justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    A criar workspace...
                                </span>
                            ) : (
                                'Criar Workspace'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
