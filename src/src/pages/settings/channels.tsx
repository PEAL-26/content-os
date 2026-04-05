import { ChannelIconOnly } from '@/components/channels/channel-badge'
import { useChannels } from '@/hooks/use-channels'
import type { ChannelConfig, SocialChannel } from '@/types/database'
import { ALL_CHANNELS, CHANNEL_LABELS, VOICE_TONES } from '@/types/database'
import { useCallback, useState } from 'react'

interface ChannelFormData {
    handle: string
    defaultTone: string
    customTone: string
    notes: string
    isActive: boolean
    isPrimary: boolean
}

function createInitialFormData(channel: ChannelConfig): ChannelFormData {
    const defaultToneValue = channel.defaultTone || ''
    const isCustomTone =
        defaultToneValue !== '' &&
        !VOICE_TONES.some((t) => t.value === defaultToneValue)
    return {
        handle: channel.handle || '',
        defaultTone: isCustomTone ? 'custom' : defaultToneValue,
        customTone: isCustomTone ? defaultToneValue : '',
        notes: channel.notes || '',
        isActive: channel.isActive,
        isPrimary: channel.isPrimary,
    }
}

function ChannelCard({
    channel,
    onUpdate,
    onDelete,
    isSaving,
}: {
    channel: ChannelConfig
    onUpdate: (id: string, data: Partial<ChannelConfig>) => Promise<boolean>
    onDelete: (id: string) => Promise<boolean>
    isSaving: boolean
}) {
    const [formData, setFormData] = useState<ChannelFormData>(() =>
        createInitialFormData(channel)
    )
    const [hasChanges, setHasChanges] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const updateField = <K extends keyof ChannelFormData>(
        field: K,
        value: ChannelFormData[K]
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
        setHasChanges(true)
    }

    const handleSave = async () => {
        const dataToSave: Partial<ChannelConfig> = {
            handle: formData.handle || null,
            isActive: formData.isActive,
            isPrimary: formData.isPrimary,
            notes: formData.notes || null,
            defaultTone:
                formData.defaultTone === 'custom'
                    ? formData.customTone || null
                    : formData.defaultTone || null,
        }

        const success = await onUpdate(channel.id, dataToSave)
        if (success) {
            setHasChanges(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        const success = await onDelete(channel.id)
        if (!success) {
            setIsDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    return (
        <div
            className={`rounded-lg border bg-white p-5 transition-all ${
                formData.isActive
                    ? 'border-gray-200 shadow-sm'
                    : 'border-gray-200 opacity-60'
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ChannelIconOnly channel={channel.channel} size="lg" />
                    <div>
                        <h3 className="font-semibold text-gray-900">
                            {CHANNEL_LABELS[channel.channel]}
                        </h3>
                        {formData.isPrimary && (
                            <span className="text-xs font-medium text-blue-600">
                                Canal principal
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar canal"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                        </svg>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            updateField('isActive', !formData.isActive)
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            formData.isActive ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                formData.isActive
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>

            <div className="mt-4 space-y-4">
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Handle / URL do perfil
                    </label>
                    <input
                        type="text"
                        value={formData.handle}
                        onChange={(e) => updateField('handle', e.target.value)}
                        disabled={!formData.isActive}
                        placeholder="@usuario ou https://..."
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <label className="relative flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.isPrimary}
                            onChange={(e) =>
                                updateField('isPrimary', e.target.checked)
                            }
                            disabled={!formData.isActive}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                        />
                        <span className="text-sm text-gray-700">
                            Canal principal
                        </span>
                    </label>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Tom padrão
                    </label>
                    <select
                        value={formData.defaultTone}
                        onChange={(e) =>
                            updateField('defaultTone', e.target.value)
                        }
                        disabled={!formData.isActive}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                    >
                        {VOICE_TONES.map((tone) => (
                            <option key={tone.value} value={tone.value}>
                                {tone.label}
                            </option>
                        ))}
                    </select>

                    {formData.defaultTone === 'custom' && (
                        <input
                            type="text"
                            value={formData.customTone}
                            onChange={(e) =>
                                updateField('customTone', e.target.value)
                            }
                            disabled={!formData.isActive}
                            placeholder="Descreve o tom personalizado..."
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                        />
                    )}
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Notas internas
                    </label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => updateField('notes', e.target.value)}
                        disabled={!formData.isActive}
                        rows={2}
                        placeholder="Notas para a equipa sobre este canal..."
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
                    />
                </div>

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                    {isSaving ? (
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
                            A guardar...
                        </span>
                    ) : hasChanges ? (
                        'Guardar alterações'
                    ) : (
                        'Guardar alterações'
                    )}
                </button>
            </div>

            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Eliminar {CHANNEL_LABELS[channel.channel]}?
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                            Esta ação não pode ser revertida. O canal e todas as
                            suas configurações serão eliminados.
                        </p>
                        <div className="mt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {isDeleting ? 'A eliminar...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export function ChannelsPage() {
    const {
        channels,
        isLoading,
        error,
        updateChannel,
        createChannel,
        deleteChannel,
    } = useChannels()
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
    const [showAddModal, setShowAddModal] = useState(false)

    const usedChannelTypes = channels.map((ch) => ch.channel)
    const availableChannels = ALL_CHANNELS.filter(
        (ch) => !usedChannelTypes.includes(ch)
    )

    const handleUpdate = useCallback(
        async (
            channelId: string,
            data: Partial<ChannelConfig>
        ): Promise<boolean> => {
            setSavingIds((prev) => new Set(prev).add(channelId))
            try {
                const success = await updateChannel(channelId, data)
                return success
            } finally {
                setSavingIds((prev) => {
                    const next = new Set(prev)
                    next.delete(channelId)
                    return next
                })
            }
        },
        [updateChannel]
    )

    const handleAddChannel = async (channelType: SocialChannel) => {
        await createChannel(channelType)
        setShowAddModal(false)
    }

    const handleDeleteChannel = async (channelId: string): Promise<boolean> => {
        return await deleteChannel(channelId)
    }

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Canais de Distribuição
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Configure os canais sociais ativos e as suas definições.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {channels.map((channel) => (
                    <ChannelCard
                        key={channel.id}
                        channel={channel}
                        onUpdate={handleUpdate}
                        onDelete={handleDeleteChannel}
                        isSaving={savingIds.has(channel.id)}
                    />
                ))}

                {availableChannels.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="flex min-h-70 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-5 transition-colors hover:border-blue-400 hover:bg-blue-50"
                    >
                        <div className="text-center">
                            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                                <svg
                                    className="h-6 w-6 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-gray-700">
                                Adicionar canal
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {availableChannels.length} disponível
                                {availableChannels.length !== 1 ? 'is' : ''}
                            </p>
                        </div>
                    </button>
                )}
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-900">
                    Informação
                </h3>
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    <li>
                        • Apenas um canal pode ser definido como principal —
                        usado como referência nas métricas
                    </li>
                    <li>
                        • O YouTube começa inativo por defeito — ative se
                        pretende criar roteiros de vídeo
                    </li>
                    <li>
                        • O tom personalizado é usado em vez do tom do workspace
                        para este canal
                    </li>
                </ul>
            </div>

            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Adicionar Canal
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                                <svg
                                    className="h-5 w-5"
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
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {availableChannels.map((channel) => (
                                <button
                                    key={channel}
                                    type="button"
                                    onClick={() => handleAddChannel(channel)}
                                    className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-gray-50"
                                >
                                    <ChannelIconOnly
                                        channel={channel}
                                        size="sm"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                        {CHANNEL_LABELS[channel]}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {availableChannels.length === 0 && (
                            <p className="py-4 text-center text-sm text-gray-500">
                                Todos os canais já foram adicionados.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
