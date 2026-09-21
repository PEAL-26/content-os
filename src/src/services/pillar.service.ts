import { supabase } from '@/lib/supabase';
import type {
    ContentPillar,
    PillarConfig,
    PillarConfigInput,
} from '@/types/pillar';
import { DEFAULT_PILLARS } from '@/types/pillar';
import { v4 as uuidv4 } from 'uuid';

export const pillarService = {
    async getPillars(workspaceId: string): Promise<PillarConfig[]> {
        const { data, error } = await supabase
            .from('pillar_configs')
            .select('*')
            .eq('workspaceId', workspaceId)
            .order('sortOrder');

        if (error) {
            throw new Error(`Erro ao buscar pilares: ${error.message}`);
        }

        return (data ?? []) as PillarConfig[];
    },

    async updatePillar(
        workspaceId: string,
        pillar: ContentPillar,
        input: PillarConfigInput
    ): Promise<PillarConfig> {
        const { data, error } = await supabase
            .from('pillar_configs')
            .update({
                name: input.name,
                objective: input.objective,
                funnelStage: input.funnelStage,
                description: input.description,
                examples: input.examples,
                isActive: input.isActive,
                sortOrder: input.sortOrder,
            })
            .eq('workspaceId', workspaceId)
            .eq('pillar', pillar)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao atualizar pilar: ${error.message}`);
        }

        return data as PillarConfig;
    },

    async createDefaultPillars(workspaceId: string): Promise<void> {
        const pillarsToInsert = DEFAULT_PILLARS.map((p) => ({
            id: uuidv4(),
            workspaceId,
            pillar: p.pillar,
            name: p.name,
            objective: p.objective,
            funnelStage: p.funnelStage,
            description: p.description,
            examples: p.examples,
            isActive: true,
            sortOrder: p.sortOrder,
        }));

        const { error } = await supabase
            .from('pillar_configs')
            .insert(pillarsToInsert);

        if (error) {
            throw new Error(
                `Erro ao criar pilares por defeito: ${error.message}`
            );
        }
    },

    async checkAndCreatePillars(workspaceId: string): Promise<boolean> {
        const existing = await this.getPillars(workspaceId);

        if (existing.length === 0) {
            await this.createDefaultPillars(workspaceId);
            return true;
        }

        return false;
    },
};
