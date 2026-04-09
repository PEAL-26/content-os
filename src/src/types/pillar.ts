import { ContentPillar, FunnelStage } from '@/generated/prisma/enums';

export type { ContentPillar, FunnelStage };

export interface PillarConfig {
    id: string;
    workspaceId: string;
    pillar: ContentPillar;
    name: string;
    objective: string | null;
    funnelStage: FunnelStage;
    description: string | null;
    examples: string[];
    isActive: boolean;
    sortOrder: number;
}

export interface PillarConfigInput {
    name?: string;
    objective?: string;
    funnelStage?: FunnelStage;
    description?: string;
    examples?: string[];
    isActive?: boolean;
    sortOrder?: number;
}

export const PILLAR_COLORS = {
    P1_EDUCATION: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-300',
        light: 'bg-blue-50',
        hover: 'hover:bg-blue-50',
    },
    P2_USE_CASES: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-300',
        light: 'bg-green-50',
        hover: 'hover:bg-green-50',
    },
    P3_CONVERSION: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-300',
        light: 'bg-orange-50',
        hover: 'hover:bg-orange-50',
    },
    P4_AUTHORITY: {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        border: 'border-purple-300',
        light: 'bg-purple-50',
        hover: 'hover:bg-purple-50',
    },
} as const;

export const PILLAR_LABELS = {
    P1_EDUCATION: 'Educação',
    P2_USE_CASES: 'Casos de Uso',
    P3_CONVERSION: 'Conversão',
    P4_AUTHORITY: 'Autoridade',
} as const;

export const PILLAR_DESCRIPTIONS = {
    P1_EDUCATION: 'Topo — Atrair',
    P2_USE_CASES: 'Meio — Mostrar valor',
    P3_CONVERSION: 'Fundo — Vender',
    P4_AUTHORITY: 'Bastidores — Confiança',
} as const;

export const DEFAULT_PILLARS = [
    {
        pillar: 'P1_EDUCATION' as ContentPillar,
        name: 'Problemas & Educação',
        objective: 'Atrair audiência com conteúdo de valor',
        funnelStage: 'TOP' as FunnelStage,
        description:
            'Conteúdo educativo que resolve problemas reais do público-alvo. Foco em "como fazer X", erros comuns, guias rápidos.',
        examples: [
            'Porque a tua empresa perde tempo com processos manuais',
            '3 formas simples de automatizar tarefas repetitivas',
            'Erros comuns na gestão de pedidos',
            'Guia rápido: como digitalizar o teu negócio',
        ],
        sortOrder: 1,
    },
    {
        pillar: 'P2_USE_CASES' as ContentPillar,
        name: 'Soluções & Casos de Uso',
        objective: 'Mostrar valor real e construir confiança',
        funnelStage: 'MIDDLE' as FunnelStage,
        description:
            'Casos práticos, antes/depois, demonstrações simples, mini tutoriais dos produtos.',
        examples: [
            'Como automatizamos pedidos em 2 dias',
            'De excel para sistema em 1 semana',
            'Caso real: cliente X reduziu erros em 80%',
            'Mini tutorial: configurar X em 10 minutos',
        ],
        sortOrder: 2,
    },
    {
        pillar: 'P3_CONVERSION' as ContentPillar,
        name: 'Produto & Conversão',
        objective: 'Converter audiência em clientes',
        funnelStage: 'BOTTOM' as FunnelStage,
        description:
            'Apresentação de features, ofertas, demos, landing pages. Directo e focado em acção.',
        examples: [
            'Sistema de gestão de pedidos — demo grátis',
            'Automatize X em menos de 24h',
            'Experimenta gratuitamente durante 14 dias',
            'Feature nova: agora podes fazer X',
        ],
        sortOrder: 3,
    },
    {
        pillar: 'P4_AUTHORITY' as ContentPillar,
        name: 'Autoridade & Bastidores',
        objective: 'Construir confiança e humanizar a marca',
        funnelStage: 'TOP' as FunnelStage,
        description:
            'Processo de desenvolvimento, decisões técnicas, falhas e aprendizados. "Build in public" leve.',
        examples: [
            'Porque não usamos ferramenta X',
            'Erro que quase nos custou um cliente',
            'Como decidimos construir Y em vez de comprar',
            'O que aprendemos depois de lançar o produto Z',
        ],
        sortOrder: 4,
    },
];

export const FUNNEL_STAGE_LABELS = {
    TOP: 'Topo (Atração)',
    MIDDLE: 'Meio (Consideração)',
    BOTTOM: 'Fundo (Conversão)',
} as const;
