import type { ContentPillar } from '@/types/pillar';

/**
 * Uma linha por dia da semana (dayOfWeek 1=Segunda ... 7=Domingo).
 *
 * `isActive` NÃO é um bloqueio — a grelha mostra sempre os 7 dias e todos
 * aceitam items. Desactivar um dia é apenas não o destacar e não sugerir
 * pilar; items já agendados nesse dia continuam visíveis.
 */
export interface PlanningConfig {
    id: string;
    workspaceId: string;
    dayOfWeek: number;
    isActive: boolean;
    suggestedPillarId: string | null;
    createdAt: string;
    updatedAt: string;
}

/**
 * O `suggestedPillarId` é o UUID de `pillar_configs.id`, mas os componentes
 * de UI (PillarBadge) recebem o enum `ContentPillar`, que vive na linha do
 * pilar. Por isso o serviço faz o join e devolve os dois — sem o enum, o
 * badge não tem o que renderizar.
 */
export interface PlanningConfigWithPillar extends PlanningConfig {
    suggestedPillar: {
        id: string;
        pillar: ContentPillar;
        name: string;
    } | null;
}

export interface UpdatePlanningConfigInput {
    isActive?: boolean;
    /** `null` remove a sugestão de pilar do dia. */
    suggestedPillarId?: string | null;
}

/**
 * Template inicial: todos os dias activos, com o par dia→pilar documentado
 * em README.md:78 (Segunda=P1, Quarta=P2, Sexta=P3). É um default editável,
 * não uma restrição — os quatro dias restantes ficam activos sem sugestão.
 */
export const DEFAULT_PILLAR_SUGGESTION: Record<number, string> = {
    1: 'P1_EDUCATION',
    3: 'P2_USE_CASES',
    5: 'P3_CONVERSION',
};