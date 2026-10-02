import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import type {
    PlanningConfig,
    PlanningConfigWithPillar,
    UpdatePlanningConfigInput,
} from '@/types/planning-config';
import { DEFAULT_PILLAR_SUGGESTION } from '@/types/planning-config';

const SELECT_WITH_PILLAR = `
    *,
    suggestedPillar:pillar_configs(id, pillar, name)
`;

export const planningConfigService = {
    async getPlanningConfigs(
        workspaceId: string
    ): Promise<PlanningConfigWithPillar[]> {
        const { data, error } = await supabase
            .from('planning_configs')
            .select(SELECT_WITH_PILLAR)
            .eq('workspaceId', workspaceId)
            .order('dayOfWeek');

        if (error) {
            throw new Error(
                `Erro ao carregar configuração de planeamento: ${error.message}`
            );
        }

        return (data ?? []) as PlanningConfigWithPillar[];
    },

    async updatePlanningConfig(
        workspaceId: string,
        dayOfWeek: number,
        input: UpdatePlanningConfigInput
    ): Promise<PlanningConfigWithPillar> {
        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };

        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        if (input.suggestedPillarId !== undefined) {
            updateData.suggestedPillarId = input.suggestedPillarId;
        }

        const { data, error } = await supabase
            .from('planning_configs')
            .update(updateData)
            .eq('workspaceId', workspaceId)
            .eq('dayOfWeek', dayOfWeek)
            .select(SELECT_WITH_PILLAR)
            .single();

        if (error) {
            throw new Error(
                `Erro ao atualizar configuração de planeamento: ${error.message}`
            );
        }

        return data as PlanningConfigWithPillar;
    },

    /**
     * Semeia as 7 linhas de um workspace novo. Os pilares sugeridos só são
     * ligados se existirem no `pillar_configs` desse workspace — um workspace
     * com pilares customizados fica com o dia activo mas sem sugestão, em vez
     * de falhar por violar a FK.
     */
    async createDefaultPlanningConfigs(workspaceId: string): Promise<void> {
        const { data: pillars, error: pillarsError } = await supabase
            .from('pillar_configs')
            .select('id, pillar')
            .eq('workspaceId', workspaceId);

        if (pillarsError) {
            throw new Error(
                `Erro ao buscar pilares para o planeamento: ${pillarsError.message}`
            );
        }

        const pillarIdByEnum = new Map(
            (pillars ?? []).map((p) => [p.pillar as string, p.id as string])
        );

        const rows = Array.from({ length: 7 }, (_, i) => {
            const dayOfWeek = i + 1;
            const suggestedEnum = DEFAULT_PILLAR_SUGGESTION[dayOfWeek];

            return {
                id: uuidv4(),
                workspaceId,
                dayOfWeek,
                isActive: true,
                suggestedPillarId: suggestedEnum
                    ? (pillarIdByEnum.get(suggestedEnum) ?? null)
                    : null,
            };
        });

        const { error } = await supabase
            .from('planning_configs')
            .insert(rows);

        if (error) {
            throw new Error(
                `Erro ao criar configuração de planeamento: ${error.message}`
            );
        }
    },

    async checkAndCreatePlanningConfigs(workspaceId: string): Promise<boolean> {
        const { data } = await supabase
            .from('planning_configs')
            .select('id')
            .eq('workspaceId', workspaceId)
            .limit(1);

        if (data && data.length > 0) {
            return false;
        }

        await this.createDefaultPlanningConfigs(workspaceId);
        return true;
    },
};

export type { PlanningConfig };