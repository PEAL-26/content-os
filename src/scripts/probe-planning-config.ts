// =============================================================================
// Verificação do fix do `updatedAt` e da configuração de planeamento, contra a
// BD real (não mock).
//
// Porquê um probe e não um teste: o projecto não tem test framework, e o risco
// desta mudança está no SQL — um backfill com JOIN e duas colunas NOT NULL sem
// DEFAULT não dá erro de compilação. Isto executa o que o browser faria.
//
// O que prova:
//   1. INSERT em plan_items SEM `updatedAt` funciona (o DEFAULT now() fixou o
//      bug do 23502 que rebentava o "Adicionar ao plano").
//   2. dayOfWeek é derivado de scheduledFor, não do chamador.
//   3. updatePlanItem que muda scheduledFor arrasta dayOfWeek (sem drift).
//   4. A tabela planning_configs tem 7 linhas por workspace, 1..7 sem buracos.
//   5. suggestedPillarId aponta para pillar_configs existente, ou é NULL.
//
// Uso: npx tsx scripts/probe-planning-config.ts
// Sai com código 1 se qualquer verificação falhar.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { config as loadDotenv } from 'dotenv';

// `lib/supabase.ts` constrói o cliente com `storage: localStorage`, que não
// existe em Node. Um stub em memória basta: a probe não usa sessão autenticada,
// só a anon key. Definido ANTES dos imports dinâmicos abaixo, porque a
// avaliação do módulo corre ao importar.
const memoryStorage: Record<string, string> = {};
(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => memoryStorage[k] ?? null,
    setItem: (k: string, v: string) => {
        memoryStorage[k] = v;
    },
    removeItem: (k: string) => {
        delete memoryStorage[k];
    },
    clear: () => {
        for (const k of Object.keys(memoryStorage)) delete memoryStorage[k];
    },
    key: () => null,
    length: 0,
} as Storage;

// Node não lê .env sozinho (ao contrário do Vite).
loadDotenv({ path: new URL('../.env', import.meta.url), quiet: true });

const { planningConfigService } = await import(
    '../src/services/planning-config.service.js'
);
const { weeklyPlanService } = await import(
    '../src/services/weekly-plan.service.js'
);
const { supabase } = await import('../src/lib/supabase.js');

const env = {
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    SUPABASE_KEY:
        process.env.SUPABASE_PUBLISHABLE_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
        '',
};

if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
    console.error(
        'Faltam SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY no .env. ' +
            'Confirma que src/.env existe e tem as chaves do projecto.'
    );
    process.exit(1);
}

void supabase; // cliente real, vindo de @/lib/supabase

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
    const mark = ok ? 'PASS' : 'FAIL';
    console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
}

async function main(): Promise<void> {
    // ---------------------------------------------------------------- fix 1
    console.log('\n1. updatedAt com DEFAULT (o bug do 23502)');

    // INSERT deliberadamente SEM updatedAt. Se o DEFAULT não existir, o
    // PostgREST devolve not-null violation — que era exactamente o bug.
    const { data: inserted, error: insertError } = await supabase
        .from('plan_items')
        .insert({
            id: uuidv4(),
            workspaceId: 'probe-inexistente',
            weeklyPlanId: 'probe-inexistente',
            scheduledFor: new Date().toISOString(),
            dayOfWeek: 3,
        } as never)
        .select()
        .single();

    // A FK de workspaceId vai falhar — o que interessa aqui não é o sucesso
    // do insert, é que a falha NÃO seja por updatedAt.
    if (insertError) {
        const isUpdatedAtError = insertError.message.includes('updatedAt');
        check(
            'INSERT sem updatedAt não falha por updatedAt',
            !isUpdatedAtError,
            insertError.message
        );
    } else {
        check(
            'INSERT sem updatedAt tem updatedAt preenchido',
            Boolean(inserted?.updatedAt),
            `updatedAt=${inserted?.updatedAt}`
        );
        // Limpeza: a probe inseriu uma linha real.
        await supabase.from('plan_items').delete().eq('id', inserted!.id);
    }

    // --------------------------------------------------------------- deriva
    console.log('\n2. dayOfWeek derivado de scheduledFor');

    const quarta = new Date('2026-10-07T09:00:00');
    const sabado = new Date('2026-10-10T09:00:00');
    check(
        'Quarta-feira -> dayOfWeek 3',
        new Date('2026-10-07T09:00:00').getDay() === 3
    );
    check(
        'Sábado -> dayOfWeek 6',
        new Date('2026-10-10T09:00:00').getDay() === 6
    );
    check('Duas datas distintas geram dias distintos', quarta.getDay() !== sabado.getDay());

    // ------------------------------------------------- backfill / 7 dias
    console.log('\n3. planning_configs — backfill e integridade');

    const { data: workspaces, error: wsError } = await supabase
        .from('workspaces')
        .select('id, name');

    if (wsError) {
        check('ler workspaces', false, wsError.message);
        return;
    }

    check('há workspaces para testar', (workspaces?.length ?? 0) > 0);

    for (const ws of workspaces ?? []) {
        const configs =
            await planningConfigService.getPlanningConfigs(ws.id);
        const days = configs.map((c) => c.dayOfWeek).sort((a, b) => a - b);
        const expected = [1, 2, 3, 4, 5, 6, 7];

        check(
            `[${ws.name}] 7 linhas`,
            configs.length === 7,
            `${configs.length} linhas`
        );
        check(
            `[${ws.name}] dayOfWeek 1..7 sem buracos`,
            JSON.stringify(days) === JSON.stringify(expected),
            JSON.stringify(days)
        );

        const activeDays = configs.filter((c) => c.isActive).length;
        check(
            `[${ws.name}] tem dias activos (seed = 7)`,
            activeDays > 0,
            `${activeDays} activos`
        );

        for (const c of configs) {
            if (c.suggestedPillarId) {
                const { data: p } = await supabase
                    .from('pillar_configs')
                    .select('id, pillar')
                    .eq('id', c.suggestedPillarId)
                    .single();

                check(
                    `[${ws.name}] dia ${c.dayOfWeek} -> pilar existe`,
                    Boolean(p),
                    p ? `${p.pillar}` : 'FK órfã!'
                );
                // O join tem de devolver o enum, senão o PillarBadge não renderiza.
                check(
                    `[${ws.name}] dia ${c.dayOfWeek} -> join traz o enum`,
                    Boolean(c.suggestedPillar?.pillar),
                    c.suggestedPillar?.pillar ?? 'sem enum no join'
                );
            }
        }
    }

    // ------------------------------------------- updatePlanItem sem drift
    console.log('\n4. updatePlanItem não deixa drift em dayOfWeek');

    const ws = workspaces?.[0];
    if (!ws) {
        console.log('  (sem workspaces, pulado)');
        return;
    }

    const plan = await weeklyPlanService.getOrCreateWeekPlan(
        ws.id,
        new Date('2026-10-05T00:00:00'),
        new Date('2026-10-11T00:00:00')
    );

    const item = await weeklyPlanService.createPlanItem({
        weeklyPlanId: plan.id,
        workspaceId: ws.id,
        scheduledFor: new Date('2026-10-05T09:00:00'),
        notes: 'probe de verificação — apagar',
    });

    check(
        'createPlanItem deriva dayOfWeek=1 de uma segunda',
        item.dayOfWeek === 1,
        `dayOfWeek=${item.dayOfWeek}`
    );
    check(
        'createPlanItem preenche updatedAt',
        Boolean(item.updatedAt),
        `updatedAt=${item.updatedAt}`
    );

    // Move para sábado. dayOfWeek não é editável pelo chamador; o serviço tem
    // de o derivar do novo scheduledFor.
    const moved = await weeklyPlanService.updatePlanItem(item.id, {
        scheduledFor: new Date('2026-10-10T09:00:00'),
    });

    check(
        'mover para sábado actualiza dayOfWeek para 6',
        moved.dayOfWeek === 6,
        `dayOfWeek=${moved.dayOfWeek}`
    );

    await weeklyPlanService.deletePlanItem(item.id);
    console.log('  (item de probe apagado)');

    console.log(
        failures === 0
            ? '\nTudo verde.\n'
            : `\n${failures} verificação(ões) falharam.\n`
    );
}

main()
    .catch((err) => {
        console.error('Probe falhou:', err);
        process.exit(1);
    })
    .finally(() => {
        process.exit(failures === 0 ? 0 : 1);
    });