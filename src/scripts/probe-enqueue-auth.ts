// =============================================================================
// Sonda ao path de autenticação do /api/ai/enqueue, sem browser e sem deploy.
//
// Cobre os estados que os bugs escondiam:
//   1. sem header          -> 401 UNAUTHORIZED ("Sem token de autenticação.")
//   2. header com token    -> o servidor VALIDA o token (chega ao Supabase)
//   3. env sem SUPABASE_URL-> 500 SERVER_MISCONFIGURED (nunca aberto)
//   4. skipAuth (dev)      -> passa sem token
//   5. userId              -> o `verifyAuth` devolve o id, e o `enqueueGeneration`
//                              recebe-o. Sem isto os providers de Definições de
//                              IA (nível de utilizador) eram invisíveis para o
//                              check e para o runtime -> NO_PROVIDER a todas as
//                              gerações.
//   6. guardas de código   -> o `userId` continua a ser passado ao enqueue e o
//                              pré-check continua a exigir modelo activo
//
// Uso: npx tsx scripts/probe-enqueue-auth.ts
// Para o caso 5 com um token real, exporta PROBE_ACCESS_TOKEN (o access token
// de uma sessão tua) antes de correr.
// =============================================================================

import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import {
    handleAiEnqueue,
    resolveAiApiEnv,
    sendServerMisconfigured,
    verifyAuth,
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

// 5. `verifyAuth` tem de devolver o userId — é ele que dá ao enqueue/job o
//    acesso aos providers de nível de utilizador.
const noTokenDev = await verifyAuth(makeReq({}), { ...env, skipAuth: true });
check('5a. dev sem token: userId é null (não inventado)', noTokenDev, {
    ok: true,
    userId: null,
});

const noTokenProd = await verifyAuth(makeReq({}), env);
check('5b. prod sem token: rejeitado', noTokenProd.ok, false);

const probeToken = process.env.PROBE_ACCESS_TOKEN ?? '';
if (env.supabaseUrl && env.supabaseAnonKey && probeToken) {
    const withToken = await verifyAuth(
        makeReq({ authorization: `Bearer ${probeToken}` }),
        env
    );
    check('5c. prod com token válido: userId é uma string', typeof withToken.ok === 'boolean' && withToken.ok && typeof withToken.userId === 'string' && withToken.userId.length > 0, true);

    const withTokenDev = await verifyAuth(
        makeReq({ authorization: `Bearer ${probeToken}` }),
        { ...env, skipAuth: true }
    );
    check(
        '5d. dev com token válido: resolve mesmo com skipAuth',
        withTokenDev.ok === true && typeof withTokenDev.userId === 'string',
        true
    );
} else {
    console.log('\n5c/5d. sem PROBE_ACCESS_TOKEN — a resolução do userId com token real fica por correr.');
}

// 6. Guardas de código: o `userId` tem de continuar a ser passado ao enqueue
//    (a linha que faltava e que fazia o NO_PROVIDER) e o pré-check tem de
//    continuar a exigir um modelo activo.
const apiSrc = readFileSync(new URL('../server/ai-api.ts', import.meta.url), 'utf8');
check('6a. enqueueGeneration recebe userId', /enqueueGeneration\(\{[\s\S]*?userId:\s*auth\.userId/.test(apiSrc), true);

const enqueueSrc = readFileSync(new URL('../server/generation/enqueue.ts', import.meta.url), 'utf8');
check('6b. pré-check exige modelo activo', /models:\s*\{\s*some:\s*\{\s*isActive:\s*true\s*\}\s*\}/.test(enqueueSrc), true);
// O scope é construction única partilhada pelo check e pelo diagnóstico, para
// os dois não divergirem: tem de incluir utilizador E workspace.
check('6c. scope = utilizador + workspace', /userId\s*\?\s*\[\{ userId \},\s*\{ workspaceId \}\]\s*:\s*\[\{ workspaceId \}\]/.test(enqueueSrc), true);
check('6d. o check usa esse scope', /OR:\s*scope\b/.test(enqueueSrc), true);
// O mesmo scope no runtime — se divergirem, o provider "passa" o check e morre
// na geração (ou o contrário).
const contextSrc = readFileSync(new URL('../server/generation/context.ts', import.meta.url), 'utf8');
check('6e. runtime usa o mesmo scope', /OR:\s*userId\s*\?\s*\[\{ userId \},\s*\{ workspaceId \}\]\s*:\s*\[\{ workspaceId \}\]/.test(contextSrc), true);

console.log(
    failures === 0
        ? '\n[probe] OK — todos os estados de autenticação e o wiring do userId estão como esperado.'
        : `\n[probe] ${failures} verificação(ões) falharam.`
);
process.exit(failures === 0 ? 0 : 1);
