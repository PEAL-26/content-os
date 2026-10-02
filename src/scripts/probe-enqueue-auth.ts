// =============================================================================
// Sonda ao path de autenticação do /api/ai/enqueue, sem browser e sem deploy.
//
// Cobre os quatro estados que o bug escondia:
//   1. sem header          -> 401 UNAUTHORIZED ("Sem token de autenticação.")
//   2. header com token    -> o servidor VALIDA o token (chega ao Supabase)
//   3. env sem SUPABASE_URL-> 500 SERVER_MISCONFIGURED (nunca aberto)
//   4. skipAuth (dev)      -> passa sem token
//
// Uso: npx tsx scripts/probe-enqueue-auth.ts
// =============================================================================

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import {
    handleAiEnqueue,
    resolveAiApiEnv,
    sendServerMisconfigured,
} from '../server/ai-api.js';

type Result = { status: number; body: Record<string, unknown> };

/** IncomingMessage mínimo: precisa de `headers` e de ser um stream legível. */
function makeReq(headers: Record<string, string>, body: unknown = {}): IncomingMessage {
    // Buffer, não string: o `readBody` do handler faz `chunk as Buffer`.
    const req = Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
    req.headers = headers;
    req.method = 'POST';
    req.url = '/api/ai/enqueue';
    return req;
}

/** ServerResponse mínimo: recolhe o status e o que foi escrito. */
function makeRes(): { res: ServerResponse; read: () => Result } {
    let status = 0;
    let raw = '';
    const res = {
        statusCode: 0,
        headers: {} as Record<string, string>,
        ended: false,
        setHeader(k: string, v: string) {
            res.headers[k.toLowerCase()] = v;
        },
        end(chunk?: string) {
            if (chunk) raw += chunk;
            res.ended = true;
        },
    } as unknown as ServerResponse;

    const proxy = new Proxy(res, {
        set(target, prop, value) {
            if (prop === 'statusCode') status = value as number;
            return Reflect.set(target, prop, value);
        },
    });

    return {
        res: proxy,
        read: () => {
            let body: Record<string, unknown> = {};
            try {
                body = JSON.parse(raw) as Record<string, unknown>;
            } catch {
                /* resposta sem corpo */
            }
            return { status, body };
        },
    };
}

const VALID_BODY = {
    jobType: 'NEW_ARTICLE',
    workspaceId: 'probe-workspace',
    params: { topic: 'sonda de autenticação' },
};

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures += 1;
    console.log(`  ${ok ? 'OK  ' : 'FALHA'} ${label}: ${JSON.stringify(actual)}`);
    if (!ok) console.log(`       esperado: ${JSON.stringify(expected)}`);
}

async function run(
    label: string,
    headers: Record<string, string>,
    env: { supabaseUrl: string; supabaseAnonKey: string; skipAuth?: boolean }
): Promise<Result> {
    const { res, read } = makeRes();
    await handleAiEnqueue(makeReq(headers, VALID_BODY), res, env);
    const result = read();
    console.log(`\n${label}`);
    console.log(`  -> ${result.status} ${JSON.stringify(result.body).slice(0, 160)}`);
    return result;
}

const env = {
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey:
        process.env.SUPABASE_PUBLISHABLE_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
        '',
};

console.log('env resolvido:', {
    supabaseUrl: env.supabaseUrl ? env.supabaseUrl.slice(0, 32) + '…' : '(vazio)',
    supabaseAnonKey: env.supabaseAnonKey ? '(definida)' : '(vazio)',
});

if (!env.supabaseUrl || !env.supabaseAnonKey) {
    console.log('\nSem credenciais de Supabase — a sonda 2 fica por correr.');
}

// 1. Sem header: tem de ser 401 "Sem token" (o bug original).
const noToken = await run('1. sem header Authorization', {}, env);
check('status', noToken.status, 401);
check('code', noToken.body.code, 'UNAUTHORIZED');
check('error', noToken.body.error, 'Sem token de autenticação.');

// 2. Header com um JWT forjado. Antes da correcção dava "Sem token"; agora tem de
//    chegar ao Supabase e sair como "Sessão inválida" — o que PROVA que o header
//    foi transmitido e lido pelo servidor.
if (env.supabaseUrl && env.supabaseAnonKey) {
    const forged = `${Buffer.from('{"alg":"HS256"}').toString('base64')}.${Buffer.from(
        '{"sub":"probe","exp":4102444800}'
    ).toString('base64')}.signature`;
    const badToken = await run('2. header com JWT inválido', { authorization: `Bearer ${forged}` }, env);
    check('status', badToken.status, 401);
    check('code', badToken.body.code, 'UNAUTHORIZED');
    check('error', badToken.body.error, 'Sessão inválida ou expirada.');
}

// 3. Env em falta -> SERVER_MISCONFIGURED, e nunca skipAuth implícito.
console.log('\n3. env sem SUPABASE_URL');
check('resolveAiApiEnv({}) -> null', resolveAiApiEnv({}), null);
check('resolveAiApiEnv({SUPABASE_URL}) -> null', resolveAiApiEnv({ SUPABASE_URL: 'x' }), null);
const { res: cfgRes, read: readCfg } = makeRes();
sendServerMisconfigured(cfgRes);
check('sendServerMisconfigured status', readCfg().status, 500);
check('sendServerMisconfigured code', readCfg().body.code, 'SERVER_MISCONFIGURED');
check('nunca deriva skipAuth', 'skipAuth' in (resolveAiApiEnv({ SUPABASE_URL: 'u', SUPABASE_PUBLISHABLE_KEY: 'k' }) ?? {}), false);

// Fallback VITE_ (deploys e .env locais já configurados só com VITE_*).
check(
    'fallback VITE_ funciona',
    resolveAiApiEnv({ VITE_SUPABASE_URL: 'u', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }),
    { supabaseUrl: 'u', supabaseAnonKey: 'k' }
);
check(
    'nomes sem VITE_ têm precedência',
    resolveAiApiEnv({
        SUPABASE_URL: 'canonico',
        SUPABASE_PUBLISHABLE_KEY: 'canonico-key',
        VITE_SUPABASE_URL: 'fallback',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'fallback-key',
    }),
    { supabaseUrl: 'canonico', supabaseAnonKey: 'canonico-key' }
);

// 4. skipAuth (o que o dev faz) tem de passar sem token.
const skip = await run('4. skipAuth=true, sem header (modo dev)', {}, { ...env, skipAuth: true });
check('não é 401', skip.status !== 401, true);

console.log(
    failures === 0
        ? '\n[probe] OK — todos os estados de autenticação behaved como esperado.'
        : `\n[probe] ${failures} verificação(ões) falharam.`
);
process.exit(failures === 0 ? 0 : 1);
