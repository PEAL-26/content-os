/**
 * Probe do diff de modelos/headers do editor de providers.
 *
 * Verifica DUAS coisas, contra o código real (não uma reimplementação):
 *
 *   1. `diffModels` / `diffHeaders` — funções puras: que conjunto de escritas
 *      cada estado do formulário produz.
 *   2. A aplicação do diff na BD — roundtrip numa row temporária, para
 *      confirmar que os ids preservados sobrevivem e que nada se perde.
 *
 * A razão de existir: a versão anterior de `updateProvider` apagava todos os
 * modelos e re-inseria. Se o `INSERT` falhasse depois do `DELETE`, o provider
 * ficava sem modelos e o `enqueue` passava a falhar toda a geração com
 * `NO_PROVIDER`.
 *
 * Correr:
 *   npx tsx scripts/probe-provider-diff.ts
 *   PROBE_USER_ID=<uuid> npx tsx scripts/probe-provider-diff.ts   # com roundtrip
 *
 * O roundtrip usa uma ligação `pg` directa (não o `Pool` do projecto): o
 * engine do Prisma e o `pool` partilham o mesmo `pg.Pool`, e o `pool_size` do
 * Supavisor (15) é contado por sessão — misturar os dois faz o Supavisor
 * responder `EMAXCONNSESSION` e **resetar as ligações já abertas**, o que
 * matava a ligação a meio das escritas.
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client, type QueryResult } from 'pg';
import {
    diffModels,
    diffHeaders,
    type ModelDraftRow,
    type ModelDiff,
} from '../src/lib/ai/provider-diff.js';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    const ok = a === e;
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
    if (!ok) {
        console.log(`         esperado: ${e}`);
        console.log(`         actual:   ${a}`);
    }
}

// -----------------------------------------------------------------------------
// 1. diffModels — puro
// -----------------------------------------------------------------------------

console.log('\n=== diffModels ===');

const base = [
    { id: 'id-a', displayName: 'A', modelCode: 'a', config: null, isActive: true },
    { id: 'id-b', displayName: 'B', modelCode: 'b', config: null, isActive: true },
];

// Nada mudou -> zero escritas. É o caso "renomeei o provider", que antes
// reescrevia todos os modelos.
{
    const d = diffModels(base, [
        { displayName: 'A', modelCode: 'a', config: {}, isActive: true },
        { displayName: 'B', modelCode: 'b', config: {}, isActive: true },
    ]);
    check('sem alterações -> 0 insert/0 update/0 remove', d, {
        insert: [],
        update: [],
        remove: [],
    });
}

// Ordem das chaves na config não pode contar como alteração.
{
    const stored = [
        {
            id: 'id-a',
            displayName: 'A',
            modelCode: 'a',
            config: { temperature: 0.7, max_tokens: 100 },
            isActive: true,
        },
    ];
    const d = diffModels(stored, [
        {
            displayName: 'A',
            modelCode: 'a',
            config: { max_tokens: 100, temperature: 0.7 },
            isActive: true,
        },
    ]);
    check('config com chaves por ordem diferente -> 0 update', d.update, []);
}

// Desactivar preserva o id e NÃO mexe na config (que ficaria null -> {}).
{
    const d = diffModels(base, [
        { displayName: 'A', modelCode: 'a', config: {}, isActive: true },
        { displayName: 'B', modelCode: 'b', config: {}, isActive: false },
    ]);
    check('desactivar -> 1 update com o id preservado', d.update, [
        { id: 'id-b', displayName: 'B', config: null, isActive: false },
    ]);
    check('desactivar -> 0 remove', d.remove, []);
}

// Adicionar + remover ao mesmo tempo.
{
    const d = diffModels(base, [
        { displayName: 'A', modelCode: 'a', config: {}, isActive: true },
        { displayName: 'C', modelCode: 'c', config: {}, isActive: true },
    ]);
    check('adicionar -> 1 insert', d.insert.map((m) => m.modelCode), ['c']);
    check('remover -> 1 remove', d.remove, ['id-b']);
    check('adicionar+remover -> 0 update do que não mudou', d.update, []);
}

// Mudar a config é uma alteração real.
{
    const d = diffModels(base, [
        { displayName: 'A', modelCode: 'a', config: { temperature: 0.2 }, isActive: true },
        { displayName: 'B', modelCode: 'b', config: {}, isActive: true },
    ]);
    check('mudar config -> 1 update', d.update, [
        { id: 'id-a', displayName: 'A', config: { temperature: 0.2 }, isActive: true },
    ]);
}

// diffHeaders
console.log('\n=== diffHeaders ===');
{
    const h = [
        { id: 'h1', key: 'X-Foo', value: '1' },
        { id: 'h2', key: 'X-Bar', value: '2' },
    ];
    check(
        'header inalterado -> nada',
        diffHeaders(h, [
            { key: 'X-Foo', value: '1' },
            { key: 'X-Bar', value: '2' },
        ]),
        { insert: [], update: [], remove: [] }
    );
    check(
        'header alterado/novo/removido',
        diffHeaders(h, [
            { key: 'X-Foo', value: '9' },
            { key: 'X-New', value: '3' },
        ]),
        {
            insert: [{ key: 'X-New', value: '3' }],
            update: [{ id: 'h1', value: '9' }],
            remove: ['h2'],
        }
    );
}

// -----------------------------------------------------------------------------
// 2. Roundtrip na BD — os ids preservados sobrevivem à escrita real?
// -----------------------------------------------------------------------------

interface ModelRowDb {
    id: string;
    displayName: string;
    modelCode: string;
    config: unknown;
    isActive: boolean;
}

const RESET_RE = /terminated|ECONNRESET|not queryable|timeout|EMAXCONNSESSION/i;

/**
 * Ligação directa com reconexão. O `DATABASE_URL` passa pelo Supavisor, que
 * repõe a sessão (ECONNRESET) quando o limite de sessões é tocado — uma
 * propriedade conhecida deste projecto, documentada em `lib/prisma.ts`. Um
 * roundtrip de ~15 statements apanha isso a meio, por isso cada statement
 * re-liga uma vez em vez de partir.
 */
class Db {
    private client: Client;

    constructor(private readonly url: string) {
        this.client = this.open();
    }

    private open(): Client {
        const c = new Client({
            connectionString: this.url,
            connectionTimeoutMillis: 20000,
            keepAlive: false,
        });
        // Sem isto, um reset do servidor crasha o processo com um 'error' event
        // não tratado.
        c.on('error', () => {});
        return c;
    }

    private async reconnect(): Promise<void> {
        try {
            await this.client.end();
        } catch {
            /* já estava fechada */
        }
        this.client = this.open();
        await this.connect();
    }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    async query(sql: string, values: unknown[] = []): Promise<QueryResult> {
        let lastError: Error | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await this.client.query(sql, values);
            } catch (e) {
                const err = e as Error;
                if (!RESET_RE.test(err.message)) throw err;
                lastError = err;
                await this.reconnect();
            }
        }
        throw lastError ?? new Error('query falhou');
    }

    async end(): Promise<void> {
        try {
            await this.client.end();
        } catch {
            /* já estava fechada */
        }
    }
}

/**
 * Réplica exacta do que `aiProviderService.syncModels` / `syncHeaders` fazem,
 * para confirmar que o diff produz o estado certo no esquema real (nomes de
 * coluna, cascade, ids).
 */
async function applyModelDiff(
    db: Db,
    providerId: string,
    existing: ModelRowDb[],
    next: ModelDraftRow[]
) {
    const diff: ModelDiff = diffModels(existing, next);

    if (diff.insert.length > 0) {
        for (const m of diff.insert) {
            await db.query(
                `INSERT INTO ai_provider_models
                     (id, "providerId", "displayName", "modelCode", config, "isActive", "createdAt")
                 VALUES ($1,$2,$3,$4,$5::jsonb,$6,now())`,
                [
                    randomUUID(),
                    providerId,
                    m.displayName,
                    m.modelCode,
                    m.config ? JSON.stringify(m.config) : null,
                    m.isActive,
                ]
            );
        }
    }

    for (const m of diff.update) {
        await db.query(
            `UPDATE ai_provider_models
                SET "displayName" = $2, config = $3::jsonb, "isActive" = $4
              WHERE id = $1`,
            [
                m.id,
                m.displayName,
                m.config ? JSON.stringify(m.config) : null,
                m.isActive,
            ]
        );
    }

    for (const id of diff.remove) {
        await db.query(`DELETE FROM ai_provider_models WHERE id = $1`, [id]);
    }
}

async function roundtrip() {
    console.log('\n=== roundtrip na BD ===');
    const userId = process.env.PROBE_USER_ID;
    if (!userId) {
        console.log('  skip — sem PROBE_USER_ID (não crio um provider sem dono)');
        return;
    }
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.log('  skip — sem DATABASE_URL');
        return;
    }

    const providerId = randomUUID();
    // `connect()` explícito: o construtor do Client não liga, e `query()` numa
    // Client por ligar atira "Client has not been connected".
    const db = new Db(url);
    await db.connect();

    try {
        await db.query(
            `INSERT INTO ai_providers
                 (id, "providerId", name, "userId", "isCustom", "isActive", priority, "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,true,true,9999,now(),now())`,
            [providerId, 'probe_diff', 'PROBE diff (temporário)', userId]
        );

        const readModels = async (): Promise<ModelRowDb[]> =>
            (
                await db.query(
                    `SELECT id, "displayName", "modelCode", config, "isActive"
                       FROM ai_provider_models WHERE "providerId" = $1`,
                    [providerId]
                )
            ).rows as ModelRowDb[];

        const seed = async (code: string, name: string) =>
            db.query(
                `INSERT INTO ai_provider_models
                     (id, "providerId", "displayName", "modelCode", "isActive", "createdAt")
                 VALUES ($1,$2,$3,$4,true,now())`,
                [randomUUID(), providerId, name, code]
            );

        await seed('a', 'A');
        await seed('b', 'B');
        await db.query(
            `INSERT INTO ai_provider_headers (id, "providerId", key, value, "createdAt")
             VALUES ($1,$2,$3,$4,now())`,
            [randomUUID(), providerId, 'X-Foo', '1']
        );

        const before = await readModels();
        const idA = before.find((m) => m.modelCode === 'a')!.id;
        const idB = before.find((m) => m.modelCode === 'b')!.id;
        console.log(
            `  criado: ${before.length} modelos (ids ${idA.slice(0, 8)}…, ${idB.slice(0, 8)}…)`
        );

        // "desactivei B, adicionei C, mudei o header" — exactamente o que a
        // versão antiga fazia por delete+insert.
        const next: ModelDraftRow[] = [
            { displayName: 'A', modelCode: 'a', config: {}, isActive: true },
            { displayName: 'B', modelCode: 'b', config: {}, isActive: false },
            { displayName: 'C', modelCode: 'c', config: { temperature: 0.3 }, isActive: true },
        ];
        await applyModelDiff(db, providerId, before, next);

        await db.query(
            `UPDATE ai_provider_headers SET value = $2 WHERE "providerId" = $1`,
            [providerId, '2']
        );

        const after = await readModels();
        const byCode = new Map(after.map((m) => [m.modelCode, m]));

        check('3 modelos depois do diff', after.length, 3);
        check('modelo A manteve o id (o delete+insert perdia-o)', byCode.get('a')!.id, idA);
        check('modelo B manteve o id', byCode.get('b')!.id, idB);
        check('modelo B ficou inactivo', byCode.get('b')!.isActive, false);
        check('modelo C é novo', byCode.get('c')!.displayName, 'C');
        check('modelo C é activo', byCode.get('c')!.isActive, true);
        check('config do modelo C gravada', byCode.get('c')!.config, { temperature: 0.3 });
        check('modelo A continua sem config (não virou {})', byCode.get('a')!.config, null);

        const headers = await db.query(
            `SELECT key, value FROM ai_provider_headers WHERE "providerId" = $1`,
            [providerId]
        );
        check('header actualizado', headers.rows, [{ key: 'X-Foo', value: '2' }]);

        // Remover um modelo deixaria o default do workspace pendurado — o
        // runtime não quebra (pickModel cai no primeiro activo), por isso o
        // editor avisa em vez de bloquear.
        const ws = await db.query(
            `SELECT count(*)::int AS n FROM workspaces WHERE "defaultAIProviderId" = $1`,
            [providerId]
        );
        check('nenhum workspace aponta para o provider de teste', ws.rows[0].n, 0);
    } finally {
        // Limpeza por id (o ON DELETE CASCADE leva modelos e headers).
        try {
            await db.query(`DELETE FROM ai_providers WHERE id = $1`, [providerId]);
            const gone = await db.query(
                `SELECT
                     (SELECT count(*)::int FROM ai_providers WHERE id = $1) AS providers,
                     (SELECT count(*)::int FROM ai_provider_models WHERE "providerId" = $1) AS models`,
                [providerId]
            );
            check('cleanup: provider removido', gone.rows[0].providers, 0);
            check('cleanup: modelos órfãos (cascade)', gone.rows[0].models, 0);
        } catch (e) {
            failures++;
            console.error(
                '  ERR cleanup — provider de teste ficou em ' + providerId,
                (e as Error).message
            );
        }
        await db.end();
    }
}

roundtrip()
    .catch((e) => {
        failures++;
        console.error('  ERR', e.message);
    })
    .then(() => {
        // `process.exitCode` em vez de `process.exit()`: quando o stdout é um
        // pipe, o exit imediato descarta o que ainda está em buffer — e o
        // resumo dos checks desaparecia.
        console.log(
            failures === 0
                ? '\n=== todos os checks passaram ==='
                : `\n=== ${failures} check(s) falharam ===`
        );
        process.exitCode = failures === 0 ? 0 : 1;
    });