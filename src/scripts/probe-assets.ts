/**
 * Probe dos artefactos (content_assets).
 *
 * Verifica, contra a Supabase real:
 *   1. Os helpers puros (extensão, MIME, tipo, URL segura, validação de
 *      ficheiro) e os limites de carregamento. Nenhuma verificação desta
 *      secção toca na rede: `createFromFiles` só chega a `uploadAssetFiles` com
 *      ficheiros que a whitelist recusa, e o `throw` acontece antes de
 *      `supabase.storage`.
 *   2. Que a tabela existe e responde a um SELECT.
 *   3. Os invariantes do backfill que continuam a ser verificáveis DEPOIS do
 *      DROP COLUMN (as colunas legacy já não existem, portanto as contagens
 *      não se podem comparar em tempo de execução).
 *   4. CRUD completo (criar → ler → apagar) de artefactos descartáveis, mais
 *      o teste NEGATIVO de âmbito por workspace.
 *   5. Que as SEIS colunas legacy já não existem (`assetUrl` E `assetName` em
 *      `articles`, `content_pieces` e `video_scripts`).
 *
 * O passo 4 cria dados com um targetId fictício, que não corresponde a nenhum
 * artigo/peça/roteiro real, e apaga exactamente as linhas que criou. Não toca
 * em conteúdo real.
 *
 * Honestidade: nada aqui pressupõe que a BD tem dados legacy específicos. Numa
 * base recém-migrada e vazia os invariantes da secção 3 são trivialmente
 * Verdadeiros, e o probe diz isso em vez de reportar um verde que não provou
 * nada. E nenhum check passa por "a rede não respondeu": os que precisam de
 * rede (secções 2 a 5) falham com o erro do PostgREST à vista.
 *
 * A contagem corre durante todo o script e o resumo `N/M verificações ok` é
 * impresso SEMPRE, inclusive no caminho de saída antecipada da secção 2.
 *
 * Uso: npm run probe:assets
 */

import type { PostgrestError } from '@supabase/supabase-js';

// =============================================================================
// Shim de browser: o cliente Supabase é criado com `storage: localStorage`, e
// isto corre em Node. Como os imports ESM são içados, o stub tem de ser
// instalado ANTES de qualquer import que toque no cliente — daí os imports
// dinâmicos abaixo.
// =============================================================================

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    globalThis.localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => store.clear(),
        key: () => null,
        length: 0,
    } as unknown as Storage;
}

await import('dotenv/config');

const { supabase } = await import('../src/lib/supabase');
const { ASSET_MIME_BY_EXTENSION } = await import('../src/types/database');
const {
    MAX_ASSETS_PER_DROP,
    MAX_ASSET_FILE_SIZE,
    assetKind,
    assetService,
    createFromFiles,
    deleteAssetsForTarget,
    extensionFromUrl,
    isSafeExternalUrl,
    sniffMimeType,
    uploadAssetFile,
    validateAssetFile,
} = await import('../src/services/content-asset.service');

// =============================================================================
// Contadores
// =============================================================================

const failures: string[] = [];
let passed = 0;
let checks = 0;
let section = '';

/** Igualdade estrutural (JSON): para valores primitivos e listas curtas. */
function tally(label: string, actual: unknown, expected: unknown): void {
    checks++;
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        passed++;
        console.log(`  ok   ${label}`);
    } else {
        console.log(
            `  FAIL ${label}\n         esperado: ${JSON.stringify(expected)}\n         obtido:   ${JSON.stringify(actual)}`
        );
        failures.push(`[${section}] ${label}`);
    }
}

/** Condição booleana. `detail` é obrigatório sempre que o check pode falhar:
 *  um FAIL sem diagnóstico obriga a ir adivinhar a causa. */
function ok(label: string, condition: boolean, detail?: string): void {
    checks++;
    if (condition) {
        passed++;
        console.log(`  ok   ${label}`);
    } else {
        console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ''}`);
        failures.push(`[${section}] ${label}`);
    }
}

/** Diagnóstico: imprime, não conta. Nunca verde nem vermelho. */
function note(message: string): void {
    console.log(`  info ${message}`);
}

function begin(title: string): void {
    section = title;
    console.log(`\n=== ${title} ===`);
}

/** Contagem acumulada, impressa no fim de cada secção. */
function running(): void {
    console.log(`  -- ${passed}/${checks} verificações ok até aqui`);
}

/**
 * Erro do PostgREST com código e mensagem. Um check que falha sem isto só
 * diz que falhou.
 */
function describePostgrest(error: PostgrestError | null | undefined): string {
    if (!error) return 'o PostgREST não devolveu erro';
    return `code=${error.code ?? '-'} · ${error.message}`;
}

/**
 * Verdadeiro SÓ quando o erro diz "esta coluna não existe".
 *
 * Um `Boolean(error)` qualquer passaria com DNS em baixo, 401, 500 ou RLS
 * negada — com a rede caída as seis verificações de "coluna removida" ficariam
 * verdes. O PostgREST sinaliza coluna em falta com PGRST204; sem código,
 * aceitamos a mensagem, mas nunca "Could not find the table" (PGRST205), que é
 * outro problema (falta a tabela inteira).
 */
function isMissingColumnError(error: PostgrestError | null): boolean {
    if (!error) return false;
    if (error.code === 'PGRST204') return true;
    const message = error.message ?? '';
    if (!/Could not find the column|schema cache/i.test(message)) return false;
    return !/Could not find the table/i.test(message);
}

/** MIME esperado para um URL, ou `undefined` quando a extensão é desconhecida
 *  (nesse caso não há nada a exigir — o mimeType pode vir do browser). */
function expectedMime(url: string): string | undefined {
    const ext = extensionFromUrl(url);
    return Object.hasOwn(ASSET_MIME_BY_EXTENSION, ext)
        ? ASSET_MIME_BY_EXTENSION[ext]
        : undefined;
}

/** Executa uma promessa sem deixar a excepção escapar: devolve o valor ou a
 *  mensagem do erro, para o check poder decidir em vez de o script morrer. */
async function attempt<T>(
    promise: Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
    try {
        return { ok: true, value: await promise };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// =============================================================================
// 1. Helpers puros (sem rede)
// =============================================================================

begin('1. Helpers puros');

tally('extensão simples', extensionFromUrl('https://x.com/a/photo.jpg'), 'jpg');
tally(
    'extensão com query string',
    extensionFromUrl('https://x.com/a/photo.png?width=800&v=2'),
    'png'
);
tally(
    'extensão com fragment',
    extensionFromUrl('https://x.com/a/clip.mp4#t=10'),
    'mp4'
);
tally('URL sem extensão', extensionFromUrl('https://x.com/path'), '');
tally(
    'ponto no host não conta como extensão',
    extensionFromUrl('https://cdn.supabase.co/object'),
    ''
);
tally('extensão composta', extensionFromUrl('https://x.com/a.tar.gz'), 'gz');
tally(
    'ponto final sem nome não quebra',
    extensionFromUrl('https://x.com/a.'),
    ''
);

tally('mime de imagem', sniffMimeType('https://x.com/a.png'), 'image/png');
tally('mime de vídeo', sniffMimeType('https://x.com/a.mp4'), 'video/mp4');
tally(
    'mime de extensão desconhecida',
    sniffMimeType('https://x.com/a.xyz'),
    null
);
tally('mime sem extensão', sniffMimeType('https://x.com/a'), null);

// Regressão: sem `Object.hasOwn`, "a.constructor" devolvia o construtor de
// Object herdado da cadeia de protótipos e "a.__proto__" devolvia o prototype
// inteiro — e o `assetKind` rebentava a seguir com ".startsWith is not a
// function".
tally(
    'sem fuga pela cadeia de protótipos (.constructor)',
    sniffMimeType('https://x/a.constructor'),
    null
);
tally(
    'sem fuga pela cadeia de protótipos (__proto__)',
    sniffMimeType('https://x/a.__proto__'),
    null
);
tally(
    'assetKind sobrevive a um mime herdado da cadeia',
    assetKind(sniffMimeType('https://x/a.constructor')),
    'file'
);
tally(
    'o mapa de extensões é construído sem protótipo',
    Object.getPrototypeOf(ASSET_MIME_BY_EXTENSION),
    null
);

tally('tipo de imagem', assetKind('image/jpeg'), 'image');
tally('tipo de vídeo', assetKind('video/mp4'), 'video');
tally('tipo de pdf', assetKind('application/pdf'), 'file');
tally('tipo sem mime', assetKind(null), 'file');

ok('http é aceite', isSafeExternalUrl('http://x.com/a.png'));
ok('https é aceite', isSafeExternalUrl('https://x.com/a.png'));
ok(
    'javascript: é recusado',
    !isSafeExternalUrl('javascript:alert(1)'),
    'um link externo javascript: seria executado ao clicar'
);
ok('data: é recusado', !isSafeExternalUrl('data:text/html,<script>'));
ok('lixo é recusado', !isSafeExternalUrl('não é um url'));

function fakeFile(name: string, type: string, size: number): File {
    // Objecto simples com o contrato que validateAssetFile lê.
    return { name, type, size } as File;
}

ok('png válido', validateAssetFile(fakeFile('a.png', 'image/png', 1000)).valid);
ok('mp4 válido', validateAssetFile(fakeFile('a.mp4', 'video/mp4', 1000)).valid);
ok(
    'pdf válido',
    validateAssetFile(fakeFile('a.pdf', 'application/pdf', 1000)).valid
);
ok(
    'zip é recusado',
    !validateAssetFile(fakeFile('a.zip', 'application/zip', 1000)).valid
);
ok(
    'ficheiro sem tipo é recusado',
    !validateAssetFile(fakeFile('a', '', 1000)).valid
);
ok(
    'acima de 25 MB é recusado',
    !validateAssetFile(fakeFile('a.png', 'image/png', MAX_ASSET_FILE_SIZE + 1))
        .valid,
    'sem limite rebenta a quota do bucket'
);
ok(
    'mesmo no limite é aceite',
    validateAssetFile(fakeFile('a.png', 'image/png', MAX_ASSET_FILE_SIZE)).valid
);

// --- O limite de 10 ficheiros por carregamento ------------------------------
//
// `createFromFiles` corta com `files.slice(0, MAX_ASSETS_PER_DROP)` ANTES de
// qualquer upload. Com ficheiros que a whitelist recusa, `uploadAssetFile`
// lança antes de tocar no `supabase.storage` — portanto isto exercita o
// caminho real do corte sem rede e sem criar nada.

tally('o limite por carregamento é 10', MAX_ASSETS_PER_DROP, 10);

const OVERSIZED_DROP = Array.from({ length: MAX_ASSETS_PER_DROP + 3 }, (_, i) =>
    fakeFile(`drop-${i}.txt`, 'text/plain', 10)
);
const dropResult = await attempt(
    createFromFiles(
        'probe-assets-ws-sem-rede',
        'PIECE',
        'probe-assets-fake-target',
        OVERSIZED_DROP
    )
);

if (!dropResult.ok) {
    ok('createFromFiles recorta o carregamento', false, dropResult.error);
} else {
    const truncation = dropResult.value.errors.find(
        (e) => e.name === 'Limite por carregamento'
    );
    tally(
        'createFromFiles reporta o corte e quantos ficheiros ignorou',
        truncation?.message,
        'Máximo de 10 ficheiros por carregamento; 3 ignorado(s).'
    );
    tally(
        'createFromFiles cria nada com ficheiros fora da whitelist',
        dropResult.value.created.length,
        0
    );
}

// --- A validação corre no caminho singular -----------------------------------
//
// `uploadAssetFile` é o caminho que o "marcar publicado" do planeador usa (um
// ficheiro sozinho, sem o plural). Se a validação vivesse só no plural, um
// .zip passava por aqui. Comparamos a mensagem com o `reason` que a MESMA
// validação produz: sem validação o erro seria o do upload ("Erro ao
// carregar artefacto: ...") e esta comparação falharia.

async function rejectionMessage(file: File): Promise<string | null> {
    const result = await attempt(uploadAssetFile(file, 'assets/probe'));
    return result.ok ? null : result.error;
}

const zipProbe = fakeFile('probe.zip', 'application/zip', 1000);
tally(
    'uploadAssetFile (singular) recusa um .zip antes do upload',
    await rejectionMessage(zipProbe),
    validateAssetFile(zipProbe).reason
);

const hugeProbe = fakeFile('probe.png', 'image/png', MAX_ASSET_FILE_SIZE + 1);
tally(
    'uploadAssetFile (singular) recusa um ficheiro acima de 25 MB',
    await rejectionMessage(hugeProbe),
    validateAssetFile(hugeProbe).reason
);

running();

// =============================================================================
// 2. A tabela responde
// =============================================================================

begin('2. Tabela content_assets');

const { error: probeError } = await supabase
    .from('content_assets')
    .select('*')
    .limit(1);

ok('a tabela responde a um SELECT', !probeError, describePostgrest(probeError));

if (probeError) {
    console.log(
        '\nA tabela não existe. Aplica as migrações primeiro:\n  npx prisma migrate deploy\nou, em desenvolvimento:\n  npm run db:migrate'
    );
    finish();
}

// =============================================================================
// 3. Backfill: invariantes verificáveis depois do DROP
// =============================================================================
//
// As colunas legacy já foram DROPed, portanto comparar `SELECT count(*)` de
// cada tabela com `SELECT count(*)` de content_assets em tempo de execução já
// não é possível. O que resta — e o que o backfill podia ter estragado — são
// os invariantes de cada linha migrada. Uma coluna apaga o valor que o
// backfill leu: o URL original (com `?` e `#` intactos) e o mimeType
// inferido da extensão.

begin('3. Backfill (invariantes por linha)');

interface AssetRow {
    id: string | null;
    workspaceId: string | null;
    targetType: string | null;
    targetId: string | null;
    url: string | null;
    mimeType: string | null;
    createdAt: string | null;
}

const INSPECT_LIMIT = 5000;
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Amostra de ofensores para o detalhe do check: sem ela só se sabe que há
 *  problema, não onde. */
function offenders(
    rows: AssetRow[],
    extra?: (row: AssetRow) => string
): string {
    return rows
        .slice(0, 3)
        .map(
            (row) =>
                `${row.targetType ?? '?'}/${row.targetId ?? '?'} url=${JSON.stringify(row.url)}` +
                (extra ? ` → ${extra(row)}` : '')
        )
        .join(' | ');
}

const {
    data: rowsData,
    error: rowsError,
    count: rowsCount,
} = await supabase
    .from('content_assets')
    .select('id, workspaceId, targetType, targetId, url, mimeType, createdAt')
    .limit(INSPECT_LIMIT);
const rows = (rowsData ?? []) as AssetRow[];

if (rowsError) {
    ok(
        'content_assets devolve as linhas para inspecção',
        false,
        describePostgrest(rowsError)
    );
    note('invariantes não avaliados: não houve linhas para inspecionar');
} else {
    ok('content_assets devolve as linhas para inspecção', true);

    ok(
        'o probe inspeccionou a tabela inteira',
        rowsCount === null || rows.length >= rowsCount,
        `contagem exacta=${rowsCount}, lidas=${rows.length}, limite=${INSPECT_LIMIT}. Uma tabela maior que o limite tornaria os invariantes parciais.`
    );

    // Diagnóstico: as contagens por targetType são para o olho humano. Não são
    // o veredicto — o probe não tem como saber o número certo sem as colunas
    // legacy, e inventar um número esperado seria o mesmo bug outra vez.
    const byType = new Map<string, number>();
    for (const row of rows) {
        const key = row.targetType ?? '(null)';
        byType.set(key, (byType.get(key) ?? 0) + 1);
    }
    for (const targetType of ['ARTICLE', 'PIECE', 'VIDEO_SCRIPT']) {
        note(`${targetType}: ${byType.get(targetType) ?? 0} artefacto(s)`);
    }
    note(`${rows.length} linha(s) no total`);
    if (rows.length === 0) {
        note(
            'base sem artefactos: os invariantes abaixo são trivialmente Verdadeiros (nada para provar). Para validar o backfill a sério, aplicar a migração a uma base com dados legacy.'
        );
    }

    const emptyUrls = rows.filter(
        (row) => typeof row.url !== 'string' || row.url.trim() === ''
    );
    ok(
        'nenhuma linha tem url vazia ou só com espaços',
        emptyUrls.length === 0,
        offenders(emptyUrls)
    );

    const emptyWorkspace = rows.filter(
        (row) =>
            typeof row.workspaceId !== 'string' || row.workspaceId.trim() === ''
    );
    ok(
        'todas as linhas têm workspaceId',
        emptyWorkspace.length === 0,
        offenders(
            emptyWorkspace,
            (row) => `workspaceId=${JSON.stringify(row.workspaceId)}`
        )
    );

    const emptyTargetId = rows.filter(
        (row) => typeof row.targetId !== 'string' || row.targetId.trim() === ''
    );
    ok(
        'todas as linhas têm targetId',
        emptyTargetId.length === 0,
        offenders(
            emptyTargetId,
            (row) => `targetId=${JSON.stringify(row.targetId)}`
        )
    );

    const emptyCreatedAt = rows.filter(
        (row) =>
            typeof row.createdAt !== 'string' || row.createdAt.trim() === ''
    );
    ok(
        'todas as linhas têm createdAt',
        emptyCreatedAt.length === 0,
        offenders(emptyCreatedAt)
    );

    const unparseableCreatedAt = rows.filter(
        (row) =>
            typeof row.createdAt === 'string' &&
            Number.isNaN(Date.parse(row.createdAt))
    );
    ok(
        'createdAt é uma data interpretável em todas as linhas',
        unparseableCreatedAt.length === 0,
        offenders(
            unparseableCreatedAt,
            (row) => `createdAt=${JSON.stringify(row.createdAt)}`
        )
    );

    // O backfill gera o id com gen_random_uuid(): um id vazio ou não-uuid
    // significa uma linha que não veio do backfill.
    const badIds = rows.filter(
        (row) => typeof row.id !== 'string' || !UUID_RE.test(row.id)
    );
    ok(
        'todas as linhas têm um id uuid',
        badIds.length === 0,
        offenders(badIds, (row) => `id=${JSON.stringify(row.id)}`)
    );

    // Regressão do bug do SQL: a extensão era extraída do URL CRU, por isso
    // ".../foto.jpg?w=800" e ".../clip.mp4#t=10" davam mimeType NULL. A
    // inferência usa o URL sem query/fragment; o `url` gravado continua a ser
    // o original.
    const mismatchedMime = rows.filter((row) => {
        if (typeof row.url !== 'string' || row.url.trim() === '') return false;
        const expected = expectedMime(row.url);
        // Extensão que o mapa não conhece: o mimeType pode vir do browser
        // (upload) ou ser null (link externo). Não há nada a exigir.
        if (expected === undefined) return false;
        return row.mimeType !== expected;
    });
    ok(
        'mimeType bate com a extensão do url em todas as linhas',
        mismatchedMime.length === 0,
        offenders(mismatchedMime, (row) => {
            const ext = extensionFromUrl(row.url ?? '');
            return `ext=${ext || '(sem extensão)'} mimeType=${JSON.stringify(row.mimeType)} esperado=${JSON.stringify(expectedMime(row.url ?? ''))}`;
        })
    );

    const nonTextMime = rows.filter(
        (row) => row.mimeType !== null && typeof row.mimeType !== 'string'
    );
    ok(
        'mimeType é sempre texto ou null',
        nonTextMime.length === 0,
        offenders(nonTextMime, (row) => `mimeType=${String(row.mimeType)}`)
    );
}

running();

// =============================================================================
// 4. CRUD + âmbito por workspace (dados descartáveis)
// =============================================================================

begin('4. CRUD e âmbito por workspace (dados descartáveis)');

const PROBE_TARGET = 'probe-assets-fake-target';
const PROBE_WS_A = 'probe-assets-ws-a';
const PROBE_WS_B = 'probe-assets-ws-b';

const createdA = await attempt(
    assetService.createAsset({
        workspaceId: PROBE_WS_A,
        targetType: 'PIECE',
        targetId: PROBE_TARGET,
        url: 'https://example.com/probe-assets/ping.txt',
        name: 'probe.txt',
        mimeType: 'text/plain',
    })
);

const createdB = await attempt(
    assetService.createAsset({
        workspaceId: PROBE_WS_A,
        targetType: 'PIECE',
        targetId: PROBE_TARGET,
        // Sem mimeType: o serviço tem de o inferir da extensão, já sem query
        // nem fragment — a mesma regra do backfill.
        url: 'https://example.com/probe-assets/photo.jpg?width=800#top',
        name: 'probe-2.jpg',
    })
);

if (!createdA.ok || !createdB.ok) {
    ok(
        'criar dois artefactos no mesmo target',
        false,
        `A: ${createdA.ok ? 'ok' : createdA.error} · B: ${createdB.ok ? 'ok' : createdB.error}`
    );
} else {
    ok('criar dois artefactos no mesmo target', true);
    const { id: id1 } = createdA.value;
    const { id: id2 } = createdB.value;

    tally(
        'mimeType preservado no primeiro',
        createdA.value.mimeType,
        'text/plain'
    );
    tally(
        'mimeType inferido da extensão, ignorando ? e #, no segundo',
        createdB.value.mimeType,
        'image/jpeg'
    );
    tally(
        'o url original fica gravado tal e qual',
        createdB.value.url,
        'https://example.com/probe-assets/photo.jpg?width=800#top'
    );

    // Objectivo do schema: vários artefactos no mesmo target.
    const inA = await attempt(
        assetService.getAssets(PROBE_WS_A, 'PIECE', PROBE_TARGET)
    );
    ok(
        'getAssets no workspace dono devolve os 2',
        inA.ok && inA.value.length === 2,
        inA.ok ? `devolveu ${inA.value.length}` : inA.error
    );

    // --- Teste NEGATIVO de âmbito ------------------------------------------
    // Um check "o filtro devolve 2" passava mesmo sem o filtro. Estes é que
    // falham se o `.eq('workspaceId', …)` desaparecer.
    const inB = await attempt(
        assetService.getAssets(PROBE_WS_B, 'PIECE', PROBE_TARGET)
    );
    ok(
        'getAssets de OUTRO workspace não devolve os artefactos',
        inB.ok && inB.value.length === 0,
        inB.ok
            ? `o workspace B viu ${inB.value.length} linha(s) do workspace A`
            : inB.error
    );

    // Apagar a partir do workspace errado não pode apagar. `deleteAsset` não
    // devolve contagem de linhas, portanto a prova é a linha continuar lá.
    const deleteFromB = await attempt(
        assetService.deleteAsset(PROBE_WS_B, id1)
    );
    const { data: survivor } = await supabase
        .from('content_assets')
        .select('id')
        .eq('id', id1)
        .maybeSingle();
    ok(
        'deleteAsset a partir do workspace errado não apaga',
        deleteFromB.ok && Boolean(survivor),
        deleteFromB.ok
            ? `a linha ${id1} ${survivor ? 'continua' : 'desapareceu'} depois do delete cross-workspace`
            : deleteFromB.error
    );

    const bulkFromB = await attempt(
        deleteAssetsForTarget(PROBE_WS_B, 'PIECE', PROBE_TARGET)
    );
    const afterBulkB = await attempt(
        assetService.getAssets(PROBE_WS_A, 'PIECE', PROBE_TARGET)
    );
    ok(
        'deleteAssetsForTarget a partir do workspace errado não apaga',
        bulkFromB.ok && afterBulkB.ok && afterBulkB.value.length === 2,
        bulkFromB.ok
            ? `o workspace A ficou com ${afterBulkB.ok ? afterBulkB.value.length : '?'} linha(s)`
            : bulkFromB.error
    );

    // --- Limpeza pelo caminho normal ---------------------------------------
    const cleanup = await Promise.all([
        attempt(assetService.deleteAsset(PROBE_WS_A, id1)),
        attempt(assetService.deleteAsset(PROBE_WS_A, id2)),
        attempt(deleteAssetsForTarget(PROBE_WS_A, 'PIECE', PROBE_TARGET)),
    ]);
    ok(
        'apagar pelo workspace dono',
        cleanup.every((r) => r.ok),
        cleanup
            .filter((r) => !r.ok)
            .map((r) => (r.ok ? '' : r.error))
            .join(' | ')
    );

    const { count: leftovers } = await supabase
        .from('content_assets')
        .select('id', { count: 'exact', head: true })
        .eq('targetId', PROBE_TARGET);
    tally('não ficaram sobras do probe', leftovers ?? 0, 0);
}

running();

// =============================================================================
// 5. As seis colunas legacy removidas
// =============================================================================
//
// Pedir explicitamente uma coluna removida devolve PGRST204 do PostgREST. Um
// erro QUALQUER não serve: com a rede em baixo um `Boolean(error)` dava verde
// às seis. Qualquer erro que não seja "coluna em falta" conta como FALHA, com
// o código e a mensagem à vista.

begin('5. Colunas legacy removidas');

const DROPPED_COLUMNS = [
    ['articles', 'assetUrl'],
    ['articles', 'assetName'],
    ['content_pieces', 'assetUrl'],
    ['content_pieces', 'assetName'],
    ['video_scripts', 'assetUrl'],
    ['video_scripts', 'assetName'],
] as const;

for (const [table, column] of DROPPED_COLUMNS) {
    const { error: droppedError } = await supabase
        .from(table)
        .select(column)
        .limit(1);
    ok(
        `${table}.${column} já não existe`,
        isMissingColumnError(droppedError),
        droppedError
            ? describePostgrest(droppedError)
            : 'a coluna ainda responde — o DROP COLUMN da migração não foi aplicado'
    );
}

running();

// =============================================================================
// Resumo — imprime SEMPRE, inclusive na saída antecipada da secção 2.
// =============================================================================

function finish(): never {
    console.log('\n---');
    console.log(`${passed}/${checks} verificações ok`);
    console.log(`(${failures.length} falharam)`);

    if (failures.length > 0) {
        console.log('\nFalharam:');
        for (const failure of failures) console.log(`  - ${failure}`);
        process.exit(1);
    }

    console.log('\nTudo certo.\n');
    // Sai explicitamente: o cliente Supabase deixa timers de auth/realtime
    // abertos e o processo ficaria pendurado à espera deles.
    process.exit(0);
}
