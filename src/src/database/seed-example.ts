// =============================================================================
// ContentOS — Prisma Seed
// Cria workspace de exemplo com configurações base
// Executar: npx prisma db seed
// =============================================================================

import {
    ContentPillar,
    FunnelStage,
    SocialChannel,
} from '../generated/prisma/client'
import { prisma } from '../lib/prisma'

async function main() {
    console.log('🌱 A iniciar seed...')

    // ---------------------------------------------------------------------------
    // 1. Workspace de exemplo
    // ---------------------------------------------------------------------------
    const workspace = await prisma.workspace.upsert({
        where: { slug: 'minha-empresa' },
        update: {},
        create: {
            name: 'Minha Empresa',
            slug: 'minha-empresa',
            description: 'Product house com múltiplos produtos digitais',
            sector: 'SaaS / Product House',
            website: 'https://minhaempresa.ao',
            voiceTone: 'Directo, técnico mas acessível. Sem buzzwords.',
            targetAudience: 'PMEs e gestores que querem automatizar processos',
            contentLanguage: 'pt',
            valueProposition:
                'Ajudamos empresas a crescer com sistemas simples e processos automatizados',
            valueRatio: 70,
            productRatio: 30,
            postsPerWeek: 3,
            articlesPerWeek: 1,
        },
    })

    console.log(`✅ Workspace criado: ${workspace.name}`)

    // ---------------------------------------------------------------------------
    // 2. Pilares de conteúdo (baseados no documento SOCIAL_MEDIA.md)
    // ---------------------------------------------------------------------------
    const pillars = [
        {
            pillar: ContentPillar.P1_EDUCATION,
            name: 'Problemas & Educação',
            objective: 'Atrair audiência com conteúdo de valor',
            funnelStage: FunnelStage.TOP,
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
            pillar: ContentPillar.P2_USE_CASES,
            name: 'Soluções & Casos de Uso',
            objective: 'Mostrar valor real e construir confiança',
            funnelStage: FunnelStage.MIDDLE,
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
            pillar: ContentPillar.P3_CONVERSION,
            name: 'Produto & Conversão',
            objective: 'Converter audiência em clientes',
            funnelStage: FunnelStage.BOTTOM,
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
            pillar: ContentPillar.P4_AUTHORITY,
            name: 'Autoridade & Bastidores',
            objective: 'Construir confiança e humanizar a marca',
            funnelStage: FunnelStage.TOP,
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
    ]

    for (const pillarData of pillars) {
        await prisma.pillarConfig.upsert({
            where: {
                workspaceId_pillar: {
                    workspaceId: workspace.id,
                    pillar: pillarData.pillar,
                },
            },
            update: {},
            create: {
                workspaceId: workspace.id,
                ...pillarData,
            },
        })
    }

    console.log(`✅ ${pillars.length} pilares de conteúdo criados`)

    // ---------------------------------------------------------------------------
    // 3. Canais de distribuição
    // ---------------------------------------------------------------------------
    const channels = [
        {
            channel: SocialChannel.LINKEDIN,
            isPrimary: true,
            defaultTone:
                'B2B, profissional mas directo. Foco em valor para gestores.',
            notes: 'Canal principal. Todos os pilares. Foco B2B.',
        },
        {
            channel: SocialChannel.INSTAGRAM,
            isPrimary: false,
            defaultTone: 'Mais visual e acessível. Educação e bastidores.',
            notes: 'Awareness e educação. Vídeos curtos e carrosséis.',
        },
        {
            channel: SocialChannel.TIKTOK,
            isPrimary: false,
            defaultTone: 'Casual, rápido, directo ao ponto.',
            notes: 'Educação + bastidores. Roteiros de vídeo curto.',
        },
        {
            channel: SocialChannel.YOUTUBE,
            isPrimary: false,
            defaultTone: 'Mais elaborado. Tutoriais e casos de uso.',
            notes: 'Opcional. Só criar se houver capacidade de consistência.',
        },
    ]

    for (const channelData of channels) {
        await prisma.channelConfig.upsert({
            where: {
                workspaceId_channel: {
                    workspaceId: workspace.id,
                    channel: channelData.channel,
                },
            },
            update: {},
            create: {
                workspaceId: workspace.id,
                isActive: channelData.channel !== SocialChannel.YOUTUBE, // YouTube inactivo por defeito
                ...channelData,
            },
        })
    }

    console.log(`✅ ${channels.length} canais configurados`)

    // ---------------------------------------------------------------------------
    // 4. Produto de exemplo
    // ---------------------------------------------------------------------------
    await prisma.product.upsert({
        where: {
            workspaceId_slug: {
                workspaceId: workspace.id,
                slug: 'sistema-gestao-pedidos',
            },
        },
        update: {},
        create: {
            workspaceId: workspace.id,
            name: 'Sistema de Gestão de Pedidos',
            slug: 'sistema-gestao-pedidos',
            description:
                'Sistema simples para gerir pedidos, clientes e entregas sem complexidade técnica.',
            tagline: 'Dos pedidos ao papel — automatizado em 24h',
            landingUrl: 'https://minhaempresa.ao/produtos/pedidos',
            targetAudience:
                'Empresas com 5-50 funcionários que gerem pedidos manualmente',
            problemSolved:
                'Perda de pedidos, erros de comunicação interna e falta de visibilidade sobre o estado das encomendas',
        },
    })

    console.log(`✅ Produto de exemplo criado`)

    // ---------------------------------------------------------------------------
    // 5. Tags de exemplo
    // ---------------------------------------------------------------------------
    const tags = [
        { name: 'automação', color: '#6366f1' },
        { name: 'gestão', color: '#10b981' },
        { name: 'tutorial', color: '#f59e0b' },
        { name: 'caso-real', color: '#ef4444' },
        { name: 'bastidores', color: '#8b5cf6' },
        { name: 'tendências', color: '#06b6d4' },
    ]

    for (const tag of tags) {
        await prisma.tag.upsert({
            where: {
                workspaceId_name: {
                    workspaceId: workspace.id,
                    name: tag.name,
                },
            },
            update: {},
            create: {
                workspaceId: workspace.id,
                ...tag,
            },
        })
    }

    console.log(`✅ ${tags.length} tags criadas`)
    console.log('\n🎉 Seed concluído com sucesso!')
    console.log(`   Workspace ID: ${workspace.id}`)
}

main()
    .catch((e) => {
        console.error('❌ Erro no seed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
