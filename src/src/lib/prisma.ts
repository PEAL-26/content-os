import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        'DATABASE_URL não configurado. Copia src/.env.example para src/.env.'
    );
}

/**
 * O pool é criado aqui (e não deixado ao `PrismaPg`) por dois motivos:
 *
 * 1. `new PrismaPg(config)` só abre o `pg.Pool` quando o Prisma liga o engine, e
 *    não expõe o pool — com config default (`max: 10`, `idleTimeoutMillis: 10s`,
 *    `connectionTimeoutMillis: 0`) não há forma de ver nem de ajustar nada.
 * 2. Passando o pool como `externalPool` ficamos com `totalCount` / `idleCount` /
 *    `waitingCount` para log de diagnóstico, e com o `pool.on('error')`.
 *
 * `max` tem de ser MUITO abaixo do `pool_size` do Supavisor (15 neste projecto,
 * partilhado com tudo o que se liga como este utilizador — o próprio Supabase já
 * ocupa alguns). Exceder o limite não é um "connect" falhado: o Supavisor recusa
 * com `(EMAXCONNSESSION)` **e reseta as ligações já abertas** (ECONNRESET), o que
 * provoca uma cascata — cada ligação morta leva o pool a abrir outra, que volta a
 * estourar o limite. Daí vinha o "Unable to start a transaction in the given time".
 */
const poolConfig: PoolConfig = {
    connectionString,
    // Longe dos 15 do Supavisor, para deixar headroom aos outros consumidores
    // desse pool. Ajustável com PG_POOL_MAX (nunca acima de ~10).
    max: Number(process.env.PG_POOL_MAX ?? (process.env.NODE_ENV === 'production' ? 2 : 4)),
    // Manter o cliente vivo evita reabrir sessão no pooler a cada 10 s (cold start).
    idleTimeoutMillis: 60_000,
    // Antes era 0 (espera infinita), o que transformava saturação num hang
    // silencioso. Agora espera até 15 s e falha com mensagem clara.
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    allowExitOnIdle: true,
};

const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
    prismaAdapter?: PrismaPg;
    prismaPool?: Pool;
};

/**
 * Memoizado sempre (não só em dev): em produção na Vercel, cada container frio
 * criava um client novo, e o anterior ficava com o seu pool de ligações abertas
 * até o container ser reciclado.
 */
const pool = (globalForPrisma.prismaPool ??= (() => {
    const created = new Pool(poolConfig);
    created.on('error', (err) => {
        // Erros em clientes ociosos: o `pg` emite e o cliente é descartado, mas
        // registamos para não perder a causa original.
        console.error('[prisma] erro em cliente ocioso do pool:', err.message);
    });
    return created;
})());

const adapter = (globalForPrisma.prismaAdapter ??= new PrismaPg(pool));

const prisma =
    globalForPrisma.prisma ??
    (globalForPrisma.prisma = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    }));

export { prisma, pool };

/** Estado do pool para diagnóstico de saturação de ligações. */
export function describePool(): {
    total: number;
    idle: number;
    waiting: number;
    max: number;
} {
    return {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        max: poolConfig.max ?? 10,
    };
}
