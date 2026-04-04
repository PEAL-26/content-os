import { useState, useEffect } from 'react'
import { PillarBadge } from './PillarBadge'
import { PILLAR_COLORS, FUNNEL_STAGE_LABELS } from '@/types/pillar'
import type { PillarConfig, PillarConfigInput } from '@/types/pillar'
import type { ContentPillar, FunnelStage } from '@/types/pillar'

interface PillarCardProps {
    pillar: PillarConfig
    onUpdate: (
        pillar: ContentPillar,
        data: PillarConfigInput
    ) => Promise<{ success: boolean; error?: string }>
    isSaving: boolean
    isSuccess: boolean
    error: string | null
}

export function PillarCard({
    pillar,
    onUpdate,
    isSaving,
    isSuccess,
    error,
}: PillarCardProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({
        name: pillar.name,
        objective: pillar.objective || '',
        funnelStage: pillar.funnelStage,
        description: pillar.description || '',
        examples: [...pillar.examples],
    })
    const [newExample, setNewExample] = useState('')

    const colors = PILLAR_COLORS[pillar.pillar]

    useEffect(() => {
        setFormData({
            name: pillar.name,
            objective: pillar.objective || '',
            funnelStage: pillar.funnelStage,
            description: pillar.description || '',
            examples: [...pillar.examples],
        })
    }, [pillar])

    const handleToggleActive = async () => {
        await onUpdate(pillar.pillar, { isActive: !pillar.isActive })
    }

    const handleSave = async () => {
        const result = await onUpdate(pillar.pillar, formData)
        if (result.success) {
            setIsEditing(false)
        }
    }

    const handleCancel = () => {
        setFormData({
            name: pillar.name,
            objective: pillar.objective || '',
            funnelStage: pillar.funnelStage,
            description: pillar.description || '',
            examples: [...pillar.examples],
        })
        setIsEditing(false)
    }

    const handleAddExample = () => {
        if (newExample.trim()) {
            setFormData((prev) => ({
                ...prev,
                examples: [...prev.examples, newExample.trim()],
            }))
            setNewExample('')
        }
    }

    const handleRemoveExample = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            examples: prev.examples.filter((_, i) => i !== index),
        }))
    }

    const hasChanges =
        formData.name !== pillar.name ||
        formData.objective !== (pillar.objective || '') ||
        formData.funnelStage !== pillar.funnelStage ||
        formData.description !== (pillar.description || '') ||
        JSON.stringify(formData.examples) !== JSON.stringify(pillar.examples)

    return (
        <div
            className={`rounded-lg border ${
                pillar.isActive ? colors.border : 'border-gray-200'
            } bg-white shadow-sm transition-all ${
                !pillar.isActive ? 'opacity-60' : ''
            }`}
        >
            <div className={`border-b ${colors.border} p-4`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <PillarBadge pillar={pillar.pillar} size="md" />
                        <div>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            name: e.target.value,
                                        }))
                                    }
                                    className="rounded-md border border-gray-300 px-2 py-1 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            ) : (
                                <h3 className="font-semibold text-gray-900">
                                    {pillar.name}
                                </h3>
                            )}
                            <p className="text-xs text-gray-500">
                                {pillar.objective || 'Sem objetivo definido'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input
                                type="checkbox"
                                checked={pillar.isActive}
                                onChange={handleToggleActive}
                                disabled={isSaving}
                                className="peer sr-only"
                            />
                            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />
                        </label>
                        <span className="text-xs text-gray-500">
                            {pillar.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700">
                        Objetivo
                    </label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={formData.objective}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    objective: e.target.value,
                                }))
                            }
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Descreva o objetivo deste pilar"
                        />
                    ) : (
                        <p className="mt-1 text-sm text-gray-600">
                            {pillar.objective || '-'}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700">
                        Etapa do Funil
                    </label>
                    {isEditing ? (
                        <select
                            value={formData.funnelStage}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    funnelStage: e.target.value as FunnelStage,
                                }))
                            }
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {Object.entries(FUNNEL_STAGE_LABELS).map(
                                ([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    ) : (
                        <p className="mt-1 text-sm text-gray-600">
                            {FUNNEL_STAGE_LABELS[pillar.funnelStage]}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700">
                        Descrição
                    </label>
                    {isEditing ? (
                        <textarea
                            value={formData.description}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                }))
                            }
                            rows={2}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Descrição interna deste pilar"
                        />
                    ) : (
                        <p className="mt-1 text-sm text-gray-600">
                            {pillar.description || '-'}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700">
                        Exemplos de Temas
                    </label>
                    <div className="mt-1 space-y-2">
                        {(isEditing ? formData.examples : pillar.examples).map(
                            (example, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2"
                                >
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">
                                        {index + 1}
                                    </span>
                                    <span className="flex-1 text-sm text-gray-600">
                                        {example}
                                    </span>
                                    {isEditing && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveExample(index)
                                            }
                                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
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
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            )
                        )}

                        {isEditing && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newExample}
                                    onChange={(e) =>
                                        setNewExample(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleAddExample()
                                        }
                                    }}
                                    placeholder="Adicionar exemplo..."
                                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddExample}
                                    className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                                >
                                    Adicionar
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                    {isSuccess && (
                        <p className="flex items-center gap-1 text-sm text-green-600">
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
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                            Guardado com sucesso
                        </p>
                    )}

                    <div className="ml-auto flex gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isSaving || !hasChanges}
                                    className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                </svg>
                                Editar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
