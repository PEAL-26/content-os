import { useWorkspace } from '@/hooks/use-workspace'
import {
    channelService,
    type UpdateChannelInput,
} from '@/services/channel.service'
import type { ChannelConfig, SocialChannel } from '@/types/database'
import { useCallback, useEffect, useState } from 'react'

export function useChannels() {
    const { currentWorkspace } = useWorkspace()
    const [channels, setChannels] = useState<ChannelConfig[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchChannels = useCallback(async () => {
        if (!currentWorkspace?.id) return

        setIsLoading(true)
        setError(null)

        try {
            const data = await channelService.getChannels(currentWorkspace.id)
            setChannels(data)
        } catch (err) {
            console.error('Error fetching channels:', err)
            setError(
                err instanceof Error ? err.message : 'Erro ao carregar canais'
            )
        } finally {
            setIsLoading(false)
        }
    }, [currentWorkspace?.id])

    useEffect(() => {
        fetchChannels()
    }, [fetchChannels])

    const getChannels = useCallback((): ChannelConfig[] => {
        return channels
    }, [channels])

    const getActiveChannels = useCallback((): ChannelConfig[] => {
        return channels.filter((ch) => ch.isActive)
    }, [channels])

    const getChannelByType = useCallback(
        (channelType: SocialChannel): ChannelConfig | undefined => {
            return channels.find((ch) => ch.channel === channelType)
        },
        [channels]
    )

    const createChannel = useCallback(
        async (channel: SocialChannel): Promise<ChannelConfig | null> => {
            if (!currentWorkspace?.id) return null

            try {
                const newChannel = await channelService.createChannel(
                    currentWorkspace.id,
                    { channel }
                )
                setChannels((prev) => [...prev, newChannel])
                return newChannel
            } catch (err) {
                console.error('Error creating channel:', err)
                setError(
                    err instanceof Error ? err.message : 'Erro ao criar canal'
                )
                return null
            }
        },
        [currentWorkspace?.id]
    )

    const deleteChannel = useCallback(
        async (channelId: string): Promise<boolean> => {
            try {
                await channelService.deleteChannel(channelId)
                setChannels((prev) => prev.filter((ch) => ch.id !== channelId))
                return true
            } catch (err) {
                console.error('Error deleting channel:', err)
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao eliminar canal'
                )
                return false
            }
        },
        []
    )

    const updateChannel = useCallback(
        async (
            channelId: string,
            data: UpdateChannelInput
        ): Promise<boolean> => {
            try {
                const updatedChannel = await channelService.updateChannel(
                    channelId,
                    data
                )

                setChannels((prev) => {
                    if (data.isPrimary === true) {
                        return prev.map((ch) =>
                            ch.id === channelId
                                ? updatedChannel
                                : ch.isPrimary
                                  ? { ...ch, isPrimary: false }
                                  : ch
                        )
                    }

                    return prev.map((ch) =>
                        ch.id === channelId ? updatedChannel : ch
                    )
                })

                return true
            } catch (err) {
                console.error('Error updating channel:', err)
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Erro ao atualizar canal'
                )
                return false
            }
        },
        []
    )

    const primaryChannel = channels.find((ch) => ch.isPrimary)

    return {
        channels,
        isLoading,
        error,
        getChannels,
        getActiveChannels,
        getChannelByType,
        createChannel,
        deleteChannel,
        updateChannel,
        primaryChannel,
        refetch: fetchChannels,
    }
}
