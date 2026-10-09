/**
 * Probe das regras e capacidades de plataforma.
 *
 * É a lógica que fecha o bug original: as regras do canal entram no prompt por
 * um bloco fixo, e a lista de tipos é ordenada por adequação real. Nada disto
 * toca na rede — é tudo puro e determinístico.
 *
 * Uso: npm run probe:platform-rules
 */

import { ALL_CHANNELS } from '../src/types/database.js';
import {
    CHANNEL_RULE_DEFAULTS,
    channelSupportsThread,
    channelSupportsType,
    hasRuleOverrides,
    resolveRules,
    sortTypesByFit,
    buildPlatformBlock,
    MAX_CHANNEL_NOTES_CHARS,
} from '../src/lib/platform-rules/index.js';
import { ALL_CONTENT_FORMATS } from '../src/helpers/content-format.js';

let passed = 0;
let failed = 0;

function tally(label: string, actual: unknown, expected: unknown): void {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        passed += 1;
        return;
    }
    failed += 1;
    console.error(`  FALHOU  ${label}`);
    console.error(`         esperado: ${e}`);
    console.error(`         obtido:   ${a}`);
}

function ok(label: string, condition: boolean): void {
    if (condition) {
        passed += 1;
        return;
    }
    failed += 1;
    console.error(`  FALHOU  ${label}`);
}

// -----------------------------------------------------------------------------
// 1. Defaults de código
// -----------------------------------------------------------------------------

console.log('defaults: todos os 10 canais têm regra completa');
for (const channel of ALL_CHANNELS) {
    const rules = resolveRules({ channel });
    const fallback = CHANNEL_RULE_DEFAULTS[channel];
    tally(`${channel}: charLimit`, rules.charLimit, fallback.charLimit);
    tally(`${channel}: visibleChars`, rules.visibleChars, fallback.visibleChars);
    ok(
        `${channel}: tem tom`,
        typeof rules.tone === 'string' && rules.tone.length > 0
    );
    ok(`${channel}: tem aspecto`, typeof rules.aspectRatio === 'string');
    ok(
        `${channel}: visibleChars <= charLimit`,
        rules.visibleChars <= rules.charLimit
    );
    ok(
        `${channel}: wordRange coerente`,
        rules.wordRangeMin <= rules.wordRangeMax
    );
}

// -----------------------------------------------------------------------------
// 2. Merge campo-a-campo dos overrides
// -----------------------------------------------------------------------------

console.log('merge: override parcial herda o resto');
{
    const channel = 'INSTAGRAM';
    const merged = resolveRules({ channel, rules: { hashtagLimit: 3 } });
    tally('hashtagLimit overridden', merged.hashtagLimit, 3);
    // Tudo o resto tem de continuar no default.
    tally(
        'charLimit herdado',
        merged.charLimit,
        CHANNEL_RULE_DEFAULTS[channel].charLimit
    );
    tally(
        'wordRange herdado',
        [merged.wordRangeMin, merged.wordRangeMax],
        [
            CHANNEL_RULE_DEFAULTS[channel].wordRangeMin,
            CHANNEL_RULE_DEFAULTS[channel].wordRangeMax,
        ]
    );
}

console.log('merge: null / vazio herda tudo');
{
    for (const rules of [null, undefined, {}, 'texto', 42, []]) {
        const merged = resolveRules({ channel: 'LINKEDIN', rules });
        tally(
            `herda tudo (${JSON.stringify(rules)})`,
            merged.charLimit,
            CHANNEL_RULE_DEFAULTS.LINKEDIN.charLimit
        );
    }
}

console.log('merge: campo com tipo errado é descartado, não crasha');
{
    const merged = resolveRules({
        channel: 'LINKEDIN',
        rules: {
            hashtagLimit: 'cinco', // errado
            charLimit: 4000, // certo
        },
    });
    tally('hashtagLimit descartado', merged.hashtagLimit, CHANNEL_RULE_DEFAULTS.LINKEDIN.hashtagLimit);
    tally('charLimit aplicado', merged.charLimit, 4000);
}

console.log('merge: extensão invertida descarta o par');
{
    const merged = resolveRules({
        channel: 'LINKEDIN',
        rules: { wordRangeMin: 500, wordRangeMax: 100 },
    });
    tally(
        'par incoerente descartado',
        [merged.wordRangeMin, merged.wordRangeMax],
        [CHANNEL_RULE_DEFAULTS.LINKEDIN.wordRangeMin, CHANNEL_RULE_DEFAULTS.LINKEDIN.wordRangeMax]
    );
}

console.log('merge: visibleChars acima do limite é aparado');
{
    const merged = resolveRules({
        channel: 'TWITTER',
        rules: { charLimit: 100, visibleChars: 900 },
    });
    tally('visibleChars aparado', merged.visibleChars, 100);
}

console.log('hasRuleOverrides');
{
    tally('sem overrides', hasRuleOverrides({ channel: 'LINKEDIN', rules: null }), false);
    tally('objecto vazio', hasRuleOverrides({ channel: 'LINKEDIN', rules: {} }), false);
    tally('com overrides', hasRuleOverrides({ channel: 'LINKEDIN', rules: { charLimit: 1 } }), true);
}

// -----------------------------------------------------------------------------
// 3. Capacidades e ordenação — nunca bloqueiam
// -----------------------------------------------------------------------------

console.log('capacidades: os 5 tipos são sempre aceitáveis em qualquer canal');
{
    for (const channel of ALL_CHANNELS) {
        for (const type of ALL_CONTENT_FORMATS) {
            // `channelSupportsType` pode ser false (não é nativo), mas o picker
            // NUNCA deixa de oferecer o tipo: é o que garante que a lista
            // devolvida tem sempre os 5.
            const ordered = sortTypesByFit(channel, ALL_CONTENT_FORMATS);
            ok(
                `${channel}/${type}: tipo continua disponível`,
                ordered.includes(type)
            );
        }
    }
}

console.log('ordenação: nativos primeiro, não-nativos por último');
{
    const whatsapp = 'WHATSAPP';
    const ordered = sortTypesByFit(whatsapp, ALL_CONTENT_FORMATS);
    const carouselIndex = ordered.indexOf('CAROUSEL');

    // No WhatsApp o carrossel não é nativo.
    ok(
        'carrossel não é nativo no WhatsApp',
        channelSupportsType(whatsapp, 'CAROUSEL') === false
    );
    ok(
        'carrossel fica depois de um tipo nativo',
        carouselIndex > ordered.indexOf('POST')
    );
    tally('todos os tipos presentes', ordered.length, ALL_CONTENT_FORMATS.length);
}

console.log('ordenação: IG tem carrossel nativo');
{
    ok(
        'carrossel é nativo no Instagram',
        channelSupportsType('INSTAGRAM', 'CAROUSEL') === true
    );
    const ordered = sortTypesByFit('INSTAGRAM', ALL_CONTENT_FORMATS);
    const postIndex = ordered.indexOf('POST');
    const carouselIndex = ordered.indexOf('CAROUSEL');
    ok('POST antes de CAROUSEL no IG', postIndex < carouselIndex);
}

console.log('threads: só onde existem de facto');
{
    ok('X tem threads', channelSupportsThread('TWITTER'));
    ok('Threads tem threads', channelSupportsThread('THREADS'));
    ok('Instagram não tem threads', !channelSupportsThread('INSTAGRAM'));
    ok('WhatsApp não tem threads', !channelSupportsThread('WHATSAPP'));
}

// -----------------------------------------------------------------------------
// 4. Bloco de plataforma — o que entra no prompt
// -----------------------------------------------------------------------------

console.log('bloco: contém o canal, o limite e a hashtagLimit');
{
    const block = buildPlatformBlock({
        channel: 'INSTAGRAM',
        handle: '@minhaempresa',
        type: 'POST',
        rules: resolveRules({ channel: 'INSTAGRAM' }),
    });
    ok('nomeia a plataforma', block.includes('Instagram'));
    ok('inclui o handle', block.includes('@minhaempresa'));
    ok('diz o limite de caracteres', /caracteres/.test(block));
    ok(
        'diz a extension em palavras',
        block.includes(String(CHANNEL_RULE_DEFAULTS.INSTAGRAM.wordRangeMin))
    );
}

console.log('bloco: instrui a adaptação quando o tipo não é nativo');
{
    const block = buildPlatformBlock({
        channel: 'WHATSAPP',
        type: 'CAROUSEL',
        rules: resolveRules({ channel: 'WHATSAPP' }),
    });
    ok('tem secção de adaptação', block.includes('Adaptação necessária'));
    ok('explica como adaptar', /numerado/i.test(block));
    ok('menciona o canal', block.includes('WhatsApp'));
}

console.log('bloco: tipo nativo não leva aviso de adaptação');
{
    const block = buildPlatformBlock({
        channel: 'INSTAGRAM',
        type: 'CAROUSEL',
        rules: resolveRules({ channel: 'INSTAGRAM' }),
    });
    ok('sem aviso de adaptação', !block.includes('Adaptação necessária'));
}

console.log('bloco: inclui o tom e as notas do canal');
{
    const block = buildPlatformBlock({
        channel: 'TIKTOK',
        type: 'SHORT_VIDEO',
        rules: resolveRules({ channel: 'TIKTOK' }),
        defaultTone: 'Casual, rápido, directo ao ponto.',
        notes: 'Educação + bastidores.\nRoteiros de vídeo curto.',
    });
    ok('tom do canal presente', block.includes('Casual, rápido'));
    ok('secção de instruções', block.includes('Instruções deste canal'));
    ok('notas multi-linha', block.includes('Educação + bastidores'));
}

console.log('bloco: as notas do utilizador entram tal e qual');
{
    const block = buildPlatformBlock({
        channel: 'LINKEDIN',
        type: 'POST',
        rules: resolveRules({ channel: 'LINKEDIN' }),
        notes: 'Foco em gestores de PME.',
    });
    ok('notas usadas literalmente', block.includes('Foco em gestores de PME.'));
}

console.log('bloco: notas longas sao truncadas ao tecto');
{
    const long = 'x'.repeat(MAX_CHANNEL_NOTES_CHARS + 500);
    const block = buildPlatformBlock({
        channel: 'LINKEDIN',
        type: 'POST',
        rules: resolveRules({ channel: 'LINKEDIN' }),
        notes: long,
    });
    // Conta os caracteres que vieram das notas (o resto do bloco é o texto
    // fixo das regras), e compara com o tecto — comparar `block.length` com
    // `long.length` não diria nada, porque o bloco também tem as regras.
    const noteChars = (block.match(/x/g) ?? []).length;
    tally('notas truncadas ao tecto', noteChars <= MAX_CHANNEL_NOTES_CHARS + 10, true);
    ok('o resto do bloco sobrevive', block.includes('Regras da plataforma'));
}

// -----------------------------------------------------------------------------
// Resumo
// -----------------------------------------------------------------------------

console.log('');
if (failed === 0) {
    console.log(`✅ probe:platform-rules — ${passed} verificações ok`);
    process.exit(0);
}
console.error(`❌ probe:platform-rules — ${failed} falhas, ${passed} ok`);
process.exit(1);