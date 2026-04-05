import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { channelService } from './channel.service'
import { pillarService } from './pillar.service'

export interface WorkspaceInitResult {
    pillarsCreated: boolean
    channelsCreated: boolean
    tagsCreated: boolean
}

export const workspaceInitService = {
    async ensureDefaultConfigs(
        workspaceId: string
    ): Promise<WorkspaceInitResult> {
        const results: WorkspaceInitResult = {
            pillarsCreated: false,
            channelsCreated: false,
            tagsCreated: false,
        }

        try {
            results.pillarsCreated =
                await pillarService.checkAndCreatePillars(workspaceId)
        } catch (error) {
            console.error('Erro ao inicializar pilares:', error)
        }

        try {
            results.channelsCreated =
                await channelService.checkAndCreateChannels(workspaceId)
        } catch (error) {
            console.error('Erro ao inicializar canais:', error)
        }

        try {
            results.tagsCreated = await this.ensureDefaultTags(workspaceId)
        } catch (error) {
            console.error('Erro ao inicializar tags:', error)
        }

        return results
    },

    async ensureDefaultTags(workspaceId: string): Promise<boolean> {
        const { data: existing } = await supabase
            .from('tags')
            .select('id')
            .eq('workspaceId', workspaceId)
            .limit(1)

        if (existing && existing.length > 0) {
            return false
        }

        const defaultTags = [
            { name: 'automação', color: '#6366f1' },
            { name: 'gestão', color: '#10b981' },
            { name: 'tutorial', color: '#f59e0b' },
            { name: 'caso-real', color: '#ef4444' },
            { name: 'bastidores', color: '#8b5cf6' },
            { name: 'tendências', color: '#06b6d4' },
        ]

        const tagsToInsert = defaultTags.map((tag) => ({
            id: uuidv4(),
            workspaceId,
            ...tag,
        }))

        await supabase.from('tags').insert(tagsToInsert)

        return true
    },

    async isInitialized(workspaceId: string): Promise<boolean> {
        const { data: pillars } = await supabase
            .from('pillar_configs')
            .select('id')
            .eq('workspaceId', workspaceId)

        return (pillars?.length ?? 0) > 0
    },
}
