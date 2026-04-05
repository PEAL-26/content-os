import { supabase } from '@/lib/supabase'
import type { ChannelConfig, SocialChannel } from '@/types/database'
import { v4 as uuidv4 } from 'uuid'

export interface CreateChannelInput {
    channel: SocialChannel
    isActive?: boolean
    isPrimary?: boolean
}

export interface UpdateChannelInput {
    isActive?: boolean
    handle?: string | null
    isPrimary?: boolean
    defaultTone?: string | null
    notes?: string | null
}

export const channelService = {
    async getChannels(workspaceId: string): Promise<ChannelConfig[]> {
        const { data, error } = await supabase
            .from('channel_configs')
            .select('*')
            .eq('workspaceId', workspaceId)
            .order('channel', { ascending: true })

        if (error) {
            throw new Error(`Erro ao buscar canais: ${error.message}`)
        }

        return (data ?? []) as ChannelConfig[]
    },

    async getActiveChannels(workspaceId: string): Promise<ChannelConfig[]> {
        const { data, error } = await supabase
            .from('channel_configs')
            .select('*')
            .eq('workspaceId', workspaceId)
            .eq('isActive', true)
            .order('channel', { ascending: true })

        if (error) {
            throw new Error(`Erro ao buscar canais ativos: ${error.message}`)
        }

        return (data ?? []) as ChannelConfig[]
    },

    async getChannel(id: string): Promise<ChannelConfig | null> {
        const { data, error } = await supabase
            .from('channel_configs')
            .select('*')
            .eq('id', id)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return null
            }
            throw new Error(`Erro ao buscar canal: ${error.message}`)
        }

        return data as ChannelConfig
    },

    async getChannelByType(
        workspaceId: string,
        channel: SocialChannel
    ): Promise<ChannelConfig | null> {
        const { data, error } = await supabase
            .from('channel_configs')
            .select('*')
            .eq('workspaceId', workspaceId)
            .eq('channel', channel)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return null
            }
            throw new Error(`Erro ao buscar canal: ${error.message}`)
        }

        return data as ChannelConfig
    },

    async getPrimaryChannel(
        workspaceId: string
    ): Promise<ChannelConfig | null> {
        const { data, error } = await supabase
            .from('channel_configs')
            .select('*')
            .eq('workspaceId', workspaceId)
            .eq('isPrimary', true)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return null
            }
            throw new Error(`Erro ao buscar canal principal: ${error.message}`)
        }

        return data as ChannelConfig
    },

    async createChannel(
        workspaceId: string,
        input: CreateChannelInput
    ): Promise<ChannelConfig> {
        const existing = await this.getChannelByType(workspaceId, input.channel)
        if (existing) {
            throw new Error('Este canal já existe')
        }

        const id = uuidv4()

        const { data, error } = await supabase
            .from('channel_configs')
            .insert({
                id,
                workspaceId,
                channel: input.channel,
                isActive: input.isActive ?? false,
                isPrimary: input.isPrimary ?? false,
                handle: null,
                defaultTone: null,
                notes: null,
            })
            .select()
            .single()

        if (error) {
            throw new Error(`Erro ao criar canal: ${error.message}`)
        }

        return data as ChannelConfig
    },

    async updateChannel(
        id: string,
        input: UpdateChannelInput
    ): Promise<ChannelConfig> {
        if (input.isPrimary === true) {
            const channel = await this.getChannel(id)
            if (channel && !channel.isPrimary) {
                const currentPrimary = await this.getPrimaryChannel(
                    channel.workspaceId
                )
                if (currentPrimary && currentPrimary.id !== id) {
                    await supabase
                        .from('channel_configs')
                        .update({ isPrimary: false })
                        .eq('id', currentPrimary.id)
                }
            }
        }

        const { data, error } = await supabase
            .from('channel_configs')
            .update({
                ...input,
            })
            .eq('id', id)
            .select()
            .single()

        if (error) {
            throw new Error(`Erro ao atualizar canal: ${error.message}`)
        }

        return data as ChannelConfig
    },

    async deleteChannel(id: string): Promise<void> {
        const { error } = await supabase
            .from('channel_configs')
            .delete()
            .eq('id', id)

        if (error) {
            throw new Error(`Erro ao eliminar canal: ${error.message}`)
        }
    },

    async createDefaultChannels(workspaceId: string): Promise<void> {
        const defaultChannels = [
            { channel: 'LINKEDIN', isActive: true, isPrimary: true },
            { channel: 'INSTAGRAM', isActive: true, isPrimary: false },
            { channel: 'TIKTOK', isActive: true, isPrimary: false },
            { channel: 'YOUTUBE', isActive: false, isPrimary: false },
        ]

        const channelsToInsert = defaultChannels.map((ch) => ({
            id: uuidv4(),
            workspaceId,
            channel: ch.channel as SocialChannel,
            isActive: ch.isActive,
            isPrimary: ch.isPrimary,
            handle: null,
            defaultTone: null,
            notes: null,
        }))

        const { error } = await supabase
            .from('channel_configs')
            .insert(channelsToInsert)

        if (error) {
            throw new Error(
                `Erro ao criar canais por defeito: ${error.message}`
            )
        }
    },

    async checkAndCreateChannels(workspaceId: string): Promise<boolean> {
        const existing = await this.getChannels(workspaceId)

        if (existing.length === 0) {
            await this.createDefaultChannels(workspaceId)
            return true
        }

        return false
    },
}
