import {
    createProductSchema,
    type CreateProductInput,
} from '@/lib/schemas/product';
import { productService } from '@/services/product.service';
import type { Product } from '@/types/database';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface ProductFormProps {
    product?: Product;
    onSubmit: (data: CreateProductInput) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export function ProductForm({
    product,
    onSubmit,
    onCancel,
    isLoading = false,
}: ProductFormProps) {
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<CreateProductInput>({
        resolver: zodResolver(createProductSchema),
        defaultValues: {
            name: product?.name || '',
            slug: product?.slug || '',
            description: product?.description || '',
            tagline: product?.tagline || '',
            landingUrl: product?.landingUrl || '',
            demoUrl: product?.demoUrl || '',
            targetAudience: product?.targetAudience || '',
            problemSolved: product?.problemSolved || '',
            isActive: product?.isActive ?? true,
        },
    });

    // eslint-disable-next-line react-hooks/incompatible-library -- watch() is required for controlled form fields
    const name = watch('name');
    const slug = watch('slug');
    const isActive = watch('isActive');

    useEffect(() => {
        if (name && !product && slug === '') {
            const generatedSlug = productService.generateSlug(name);
            setValue('slug', generatedSlug);
        }
    }, [name, product, slug, setValue]);

    const handleReset = () => {
        reset({
            name: product?.name || '',
            slug: product?.slug || '',
            description: product?.description || '',
            tagline: product?.tagline || '',
            landingUrl: product?.landingUrl || '',
            demoUrl: product?.demoUrl || '',
            targetAudience: product?.targetAudience || '',
            problemSolved: product?.problemSolved || '',
            isActive: product?.isActive ?? true,
        });
    };

    const regenerateSlug = () => {
        if (name) {
            setValue('slug', productService.generateSlug(name));
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Nome *
                    </label>
                    <input
                        {...register('name')}
                        type="text"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        placeholder="Sistema de Gestão de Pedidos"
                    />
                    {errors.name && (
                        <p className="mt-1 text-xs text-red-600">
                            {errors.name.message}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Slug *
                    </label>
                    <div className="flex gap-2">
                        <input
                            {...register('slug')}
                            type="text"
                            className="mt-1 block flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            placeholder="sistema-gestao-pedidos"
                        />
                        <button
                            type="button"
                            onClick={regenerateSlug}
                            className="mt-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                            title="Gerar a partir do nome"
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
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                        </button>
                    </div>
                    {errors.slug && (
                        <p className="mt-1 text-xs text-red-600">
                            {errors.slug.message}
                        </p>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Tagline
                </label>
                <input
                    {...register('tagline')}
                    type="text"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    placeholder="Das pedidos ao papel — automatizado em 24h"
                />
                {errors.tagline && (
                    <p className="mt-1 text-xs text-red-600">
                        {errors.tagline.message}
                    </p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Descrição
                </label>
                <textarea
                    {...register('description')}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    placeholder="Sistema simples para gerir pedidos, clientes e entregas sem complexidade técnica."
                />
                {errors.description && (
                    <p className="mt-1 text-xs text-red-600">
                        {errors.description.message}
                    </p>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Landing Page URL
                    </label>
                    <input
                        {...register('landingUrl')}
                        type="url"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        placeholder="https://empresa.com/produto"
                    />
                    {errors.landingUrl && (
                        <p className="mt-1 text-xs text-red-600">
                            {errors.landingUrl.message}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Demo URL
                    </label>
                    <input
                        {...register('demoUrl')}
                        type="url"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        placeholder="https://demo.empresa.com"
                    />
                    {errors.demoUrl && (
                        <p className="mt-1 text-xs text-red-600">
                            {errors.demoUrl.message}
                        </p>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Público-alvo
                </label>
                <input
                    {...register('targetAudience')}
                    type="text"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    placeholder="Empresas com 5-50 funcionários que gerem pedidos manualmente"
                />
                {errors.targetAudience && (
                    <p className="mt-1 text-xs text-red-600">
                        {errors.targetAudience.message}
                    </p>
                )}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Problema que resolve
                </label>
                <textarea
                    {...register('problemSolved')}
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    placeholder="Perda de pedidos, erros de comunicação interna e falta de visibilidade sobre o estado das encomendas"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Este campo é usado para gerar prompts de IA
                </p>
                {errors.problemSolved && (
                    <p className="mt-1 text-xs text-red-600">
                        {errors.problemSolved.message}
                    </p>
                )}
            </div>

            {product && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setValue('isActive', !isActive)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isActive ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                    <span className="text-sm text-gray-700">
                        {isActive ? 'Produto ativo' : 'Produto inativo'}
                    </span>
                </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-4">
                <button
                    type="button"
                    onClick={() => {
                        handleReset();
                        onCancel();
                    }}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading ? (
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
                    ) : product ? (
                        'Guardar alterações'
                    ) : (
                        'Criar produto'
                    )}
                </button>
            </div>
        </form>
    );
}
