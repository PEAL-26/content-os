/**
 * Probe dos prompts de MEDIA e dos marcadores de ilustração de artigos.
 *
 * Verifica as duas decisões que não têm como ser testadas à mão sem gastar
 * tokens:
 *   1. `parseMediaPromptResponse` — o JSON que o modelo devolve, incluindo os
 *      casos em que devolve um esqueleto de schema em vez de um prompt.
 *   2. `extractIllustrationMarkers` / `buildArticleExport` — o parser do formato
 *      `[IMAGEM SUGERIDA — ...]` que já existe nos artigos do utilizador.
 *
 * É aqui que está o requisito de portabilidade: um prompt de media tem de ser
 * genérico (nada de plataforma) e autocontido (nada de formato), para poder ser
 * gerado noutro sítio.
 *
 * Uso: npm run probe:media
 */

import {
    mediaSubjectsForPiece,
    parseMediaPromptResponse,
    type MediaSubject,
} from '../src/lib/ai/media-prompts.js';
import {
    ARTICLE_ILLUSTRATION_INSTRUCTIONS,
    buildArticleExport,
    extractIllustrationMarkers,
    hasIllustrationMarkers,
    ILLUSTRATION_MARKER_RE,
    illustrationMarkers,
} from '../src/lib/ai/illustrations.js';
import {
    estimateCostUsd,
    formatCostUsd,
    HIGH_COST_USD,
    priceFor,
} from '../src/lib/media/pricing.js';
import {
    resolveAllMediaModels,
    resolveMediaModel,
    type MediaCandidate,
} from '../src/lib/media/resolution.js';

/** Candidato de media com valores por omissão legíveis no teste. */
function candidate(
    providerTechnicalId: string,
    modelCode: string,
    modalities: string[],
    isActive: boolean,
    priority: number
): MediaCandidate {
    return {
        providerId: `${providerTechnicalId}-${modelCode}`,
        providerTechnicalId,
        modelCode,
        modalities,
        isActive,
        priority,
    };
}

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
    if (condition) {
        passed += 1;
        return;
    }
    failed += 1;
    console.error(`  FALHOU  ${label}`);
}

/** `ok` que mostra o valor recebido quando falha — poupa um ciclo de debug. */
function okIs(label: string, actual: unknown, expected: unknown): void {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    if (pass) {
        passed += 1;
        return;
    }
    failed += 1;
    console.error(`  FALHOU  ${label}`);
    console.error(`         esperado: ${JSON.stringify(expected)}`);
    console.error(`         obtido:   ${JSON.stringify(actual)}`);
}

function tally(label: string, actual: unknown, expected: unknown): void {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        passed += 1;
        return;
    }
    failed += 1;
    console.error(`  FALHOU  ${label}`);
    console.error(`         esperado: ${JSON.stringify(expected)}`);
    console.error(`         obtido:   ${JSON.stringify(actual)}`);
}

// -----------------------------------------------------------------------------
// 1. parseMediaPromptResponse
// -----------------------------------------------------------------------------

console.log('media parse: JSON simples');
{
    const parsed = parseMediaPromptResponse(
        'image',
        '{"prompt": "Uma secretária de madeira com um portátil aberto a mostrar um gráfico ascendente, luz de manhã da janela à esquerda", "negativePrompt": "texto ilegível, mãos"}'
    );
    ok('aceita prompt simples', parsed !== null);
    // `.includes` é sensível aos acentos: a palavra no prompt é "secretária",
    // por isso a comparação tem de usar a mesma grafia.
    okIs('prompt extraído', parsed?.prompt.includes('secretária'), true);
    okIs('negativePrompt extraído', parsed?.negativePrompt?.includes('ilegível'), true);
}

console.log('media parse: cercas ```json');
{
    const parsed = parseMediaPromptResponse(
        'image',
        'Aqui vai:\n```json\n{"prompt": "Um café numa mesa de mármore com luz suave lateral, fundo desfocado", "negativePrompt": null}\n```\nEspero que ajude.'
    );
    ok('aceita resposta com cercas', parsed !== null);
    ok('prompt extraído', parsed?.prompt.includes('mármore') === true);
    ok('negativePrompt null', parsed?.negativePrompt === null);
}

console.log('media parse: rejeita esqueleto de schema');
{
    // Quando o modelo copia o exemplo do prompt, devolve "string" / "text".
    // Guardar isso como prompt seria pior que não guardar nada.
    const parsed = parseMediaPromptResponse(
        'image',
        '{"prompt": "string", "negativePrompt": "string"}'
    );
    ok('rejeita "string"', parsed === null);

    const parsed2 = parseMediaPromptResponse(
        'image',
        '{"prompt": "a prompt"}'
    );
    ok('rejeita rótulo curto', parsed2 === null);

    const parsed3 = parseMediaPromptResponse(
        'image',
        '{"prompt": "..."}'
    );
    ok('rejeita "..."', parsed3 === null);
}

console.log('media parse: sem negativePrompt (audio)');
{
    const parsed = parseMediaPromptResponse(
        'audio',
        '{"prompt": "Locução calma, ritmo lento, em português europeu, a explicar como funciona o registo de um cliente"}'
    );
    ok('aceita áudio sem negativePrompt', parsed !== null);
    ok('negativePrompt ausente vira null', parsed?.negativePrompt === null);
}

console.log('media parse: lixo / sem JSON');
{
    ok('sem objeto', parseMediaPromptResponse('image', 'Só texto, sem JSON.') === null);
    ok('JSON inválido', parseMediaPromptResponse('image', '{ isto não é JSON') === null);
    ok('vazio', parseMediaPromptResponse('image', '') === null);
}

console.log('media parse: áudio nunca guarda negativePrompt');
{
    const parsed = parseMediaPromptResponse(
        'audio',
        '{"prompt": "Uma voz feminina calorosa a narrar um tutorial de três minutos, tom de conversa", "negativePrompt": "eco, ruído de fundo"}'
    );
    ok('negativePrompt ignorado no áudio', parsed?.negativePrompt === null);
}

// -----------------------------------------------------------------------------
// 2. mediaSubjectsForPiece — a granularidade por slide/cena
// -----------------------------------------------------------------------------

console.log('subjects: carrossel da um prompt por slide');
{
    const subjects = mediaSubjectsForPiece('CAROUSEL', {
        title: 'Um guia',
        body: 'texto',
        slides: [
            { order: 1, title: 'Começo', body: 'Ideia principal' },
            { order: 2, title: 'Meio', body: 'Desenvolvimento' },
            { order: 3, title: 'Fim', body: 'Chamada à acção' },
        ],
        scenes: null,
    });
    tally('três prompts (um por slide)', subjects.length, 3);
    tally('chave do slide 2', subjects[1]?.itemKey, 'slide-2');
    ok('o texto do slide entra no assunto', subjects[0]?.text.includes('Começo') === true);
}

console.log('subjects: video da um prompt por cena');
{
    const subjects = mediaSubjectsForPiece('VIDEO', {
        title: 'Um vídeo',
        body: 'roteiro',
        slides: null,
        scenes: [
            { order: 1, kind: 'hook', narration: 'Isto vai mudar a forma de registar clientes', visual: 'Ecrã fechado a abrir' },
            { order: 2, kind: 'solution', narration: 'Basta preencher três campos', visual: 'Formulário a preencher' },
        ],
    });
    tally('dois prompts (um por cena)', subjects.length, 2);
    tally('chave da cena 2', subjects[1]?.itemKey, 'scene-2');
    ok('o visual da cena entra no assunto', subjects[1]?.text.includes('Formulário') === true);
}

console.log('subjects: post dá um único prompt');
{
    const subjects = mediaSubjectsForPiece('POST', {
        title: 'Um título',
        body: 'O corpo do post.',
        slides: null,
        scenes: null,
    });
    tally('um prompt', subjects.length, 1);
    tally('chave "main"', subjects[0]?.itemKey, 'main');
}

// -----------------------------------------------------------------------------
// 3. Marcadores de ilustração de artigos — o formato que JÁ existe
// -----------------------------------------------------------------------------

console.log('ilustracoes: extrai marcadores do formato existente');
{
    const body = [
        '## Introdução',
        '',
        'Alguma texto de abertura.',
        '',
        '[IMAGEM SUGERIDA — Mostrar dois ciclos concêntricos. No interior: "Reason → Act → Observe".]',
        '',
        'Mais texto.',
        '',
        '[IMAGEM SUGERIDA — Duas pessoas a olhar para um quadro kanban num escritório.]',
        '',
        '## Conclusão',
    ].join('\n');

    const { markers } = extractIllustrationMarkers(body);
    tally('dois marcadores', markers.length, 2);
    tally('chave do primeiro', markers[0]?.itemKey, 'ilustracao-1');
    ok('descrição sem os parênteses', markers[0]?.description.startsWith('Mostrar') === true);
    ok('aspas preservadas na descrição', markers[0]?.description.includes('Reason → Act → Observe') === true);
    ok('tem marcadores', hasIllustrationMarkers(body));
}

console.log('ilustrações: aceita as variantes do travessão');
{
    for (const dash of ['—', '–', '-', ':']) {
        const line = `[IMAGEM SUGERIDA ${dash} Uma cena qualquer]`;
        ok(`aceita "${dash}"`, ILLUSTRATION_MARKER_RE.test(line));
    }
}

console.log('ilustrações: sem marcador');
{
    ok('texto normal', !hasIllustrationMarkers('Só um artigo normal.'));
    ok('sem parênteses não conta', !hasIllustrationMarkers('[IMAGEM]'));
    tally('lista vazia', illustrationMarkers('nada aqui').length, 0);
}

console.log('ilustrações: export converte para ![alt](url)');
{
    const body = [
        'Texto antes.',
        '[IMAGEM SUGERIDA — Duas pessoas diante de um quadro.]',
        'Texto depois.',
    ].join('\n');

    const exported = buildArticleExport(body, [
        { itemKey: 'ilustracao-1', url: 'https://exemplo.com/img.png' },
    ]);
    ok('tem markdown de imagem', exported.includes('![Duas pessoas diante de um quadro.](https://exemplo.com/img.png)'));
    ok('o marcador desapareceu', !exported.includes('[IMAGEM SUGERIDA'));
    ok('o texto circundante ficou', exported.includes('Texto antes.'));
}

console.log('ilustrações: marcador sem imagem é removido em silêncio');
{
    const body = [
        'Texto antes.',
        '[IMAGEM SUGERIDA — Uma cena sem imagem gerada.]',
        'Texto depois.',
    ].join('\n');

    const exported = buildArticleExport(body, []);
    ok('marcador removido', !exported.includes('IMAGEM SUGERIDA'));
    ok('conteúdo preservado', exported.includes('Texto antes.') && exported.includes('Texto depois.'));
}

console.log('ilustrações: o texto alternativo escapa ]');
{
    const body = '[IMAGEM SUGERIDA — Um [elemento]ockout]';
    const exported = buildArticleExport(body, [
        { itemKey: 'ilustracao-1', url: 'https://exemplo.com/a.png' },
    ]);
    ok('sem ] a partir o markdown', !exported.includes('lockout]('));
}

console.log('ilustrações: instruções de geração dizem o formato');
{
    ok('menciona [IMAGEM SUGERIDA', ARTICLE_ILLUSTRATION_INSTRUCTIONS.includes('[IMAGEM SUGERIDA'));
    ok('proíbe markdown de imagem', /Nunca escrevas Markdown de imagem|NUNCA/i.test(ARTICLE_ILLUSTRATION_INSTRUCTIONS));
}

// -----------------------------------------------------------------------------
// 3. Resolução de modelo e preços (fonte partilhada com a UI)
// -----------------------------------------------------------------------------

console.log('media dispatch: sem candidatos');
{
    const res = resolveMediaModel('image', [], null);
    ok('sem modelo', res.candidate === null);
    ok('diz porquê', (res.reason ?? '').length > 0);
}

console.log('media dispatch: filtra por modalidade e actividade');
{
    const res = resolveMediaModel(
        'image',
        [
            candidate('openai', 'gpt-5', ['text'], true, 1),
            candidate('openai', 'dall-e-3', ['image'], true, 1),
            candidate('google', 'imagen-3', ['image'], false, 2),
        ],
        null
    );
    okIs('escolhe o único activo com a modalidade', res.candidate?.modelCode, 'dall-e-3');
    ok('sem motivo quando há modelo', res.reason === null);
}

console.log('media dispatch: primeiro por priority');
{
    const res = resolveMediaModel(
        'video',
        [
            candidate('google', 'veo-fast', ['video'], true, 5),
            candidate('google', 'veo-3', ['video'], true, 2),
        ],
        null
    );
    okIs('menor priority ganha', res.candidate?.modelCode, 'veo-3');
}

console.log('media dispatch: mapeamento explícito do workspace');
{
    const usable = [
        candidate('google', 'veo-fast', ['video'], true, 5),
        candidate('google', 'veo-3', ['video'], true, 2),
    ];
    okIs(
        'mapeamento gana à priority',
        resolveMediaModel('video', usable, { video: 'veo-fast' }).candidate
            ?.modelCode,
        'veo-fast'
    );
    okIs(
        'mapeamento para modelo inexistente degrada para automático',
        resolveMediaModel('video', usable, { video: 'nao-existe' }).candidate
            ?.modelCode,
        'veo-3'
    );
}

console.log('media dispatch: resolve as três modalidades de uma vez');
{
    const all = resolveAllMediaModels(
        [
            candidate('openai', 'gpt-5', ['text'], true, 1),
            candidate('openai', 'dall-e-3', ['image'], true, 1),
            candidate('elevenlabs', 'eleven-v3', ['audio'], true, 1),
        ],
        null
    );
    okIs('imagem', all.image.candidate?.modelCode, 'dall-e-3');
    okIs('áudio', all.audio.candidate?.modelCode, 'eleven-v3');
    ok('vídeo sem modelo', all.video.candidate === null);
}

console.log('media preços: por imagem, por segundo e por caracteres');
{
    okIs(
        'imagem OpenAI',
        estimateCostUsd(priceFor('openai', 'image'), { prompt: '' }),
        0.04
    );
    okIs(
        'vídeo 30 s do Veo',
        estimateCostUsd(priceFor('google', 'video'), {
            prompt: '',
            durationSec: 30,
        }),
        22.5
    );
    // 2000 caracteres × $0.30/1M = $0.0006
    okIs(
        'áudio ElevenLabs por caracteres',
        estimateCostUsd(priceFor('elevenlabs', 'audio'), {
            prompt: 'x'.repeat(2000),
        }),
        0.0006
    );
    okIs('provider sem preço', priceFor('anthropic', 'image'), null);
    okIs(
        'estimativa sem preço dá null em vez de inventar',
        estimateCostUsd(null, { prompt: 'x' }),
        null
    );
}

console.log('media preços: formatação');
{
    okIs('zero arredonda', formatCostUsd(0.0006), '< $0.01');
    okIs('vídeo com 2 casas', formatCostUsd(22.5), '$22.50');
    okIs('desconhecido', formatCostUsd(null), 'custo desconhecido');
}

console.log('media preços: limiar de custo alto');
{
    ok('vídeo do Veo é caro', 22.5 >= HIGH_COST_USD);
    ok('imagem não é cara', !(0.04 >= HIGH_COST_USD));
}

// -----------------------------------------------------------------------------
// Resumo
// -----------------------------------------------------------------------------

console.log('');
if (failed === 0) {
    console.log(`✅ probe:media — ${passed} verificações ok`);
    process.exit(0);
}
console.error(`❌ probe:media — ${failed} falhas, ${passed} ok`);
process.exit(1);

// Silencia o aviso de `MediaSubject` não usado — é o tipo de retorno.
void ({} as unknown as MediaSubject);