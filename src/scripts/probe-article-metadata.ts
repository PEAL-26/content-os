import {
    articleMetadataUpdateData,
    canGenerateMetadata,
    isMetadataFieldMissing,
    missingMetadataFields,
    parseArticleMetadataResponse,
} from '../src/lib/ai/article-metadata.js';
import type { MetadataField } from '../src/lib/ai/generation-job-types.js';

// Testes da lógica pura dos metadados (job ARTICLE_METADATA): o que decide o que
// é gravado no artigo. O ponto sensível é o parse — um valor mal interpretado
// apaga trabalho do utilizador, e um esqueleto de schema aceite como conteúdo
// grava lixo no artigo.
//
// Correr: npx tsx scripts/probe-article-metadata.ts

let falhas = 0;
let total = 0;

function check(nome: string, ok: boolean, detalhe?: string): void {
    total += 1;
    if (ok) {
        console.log(`  ok    ${nome}`);
        return;
    }
    falhas += 1;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}

// ---------------------------------------------------------------------------
// parseArticleMetadataResponse
// ---------------------------------------------------------------------------

console.log('\nparseArticleMetadataResponse');

// Todos os campos pedidos, bem formados.
const todos: MetadataField[] = [
    'summary',
    'keywords',
    'seoTitle',
    'seoDescription',
];
const completo = parseArticleMetadataResponse(
    JSON.stringify({
        summary: 'Como automatizar a gestão de pedidos.',
        keywords: ['automatização', 'pedidos', 'e-commerce'],
        seoTitle: 'Automatizar pedidos com IA',
        seoDescription: 'Como usar IA na gestão de pedidos.',
    }),
    todos
);
check('JSON completo devolve os 4 campos', !!completo?.summary && !!completo?.keywords);
check('keywords normalizadas', completo?.keywords?.length === 3);

// Só pede summary → o resto que o modelo devolve é IGNORADO. É a garantia de
// que "Gerar resumo" não escreve também o seoTitle.
const soSummary = parseArticleMetadataResponse(
    JSON.stringify({ summary: 'Um resumo.', seoTitle: 'Não pedido' }),
    ['summary']
);
check('ignora campos não pedidos', !!soSummary?.summary && !('seoTitle' in soSummary));

// JSON parcial: pediu 2, veio 1 → devolve o que veio (o outro fica FAILED no
// job, com o seu próprio erro, sem pôr em risco o outro campo).
const parcial = parseArticleMetadataResponse(
    JSON.stringify({ summary: 'Só_this.' }),
    ['summary', 'seoTitle']
);
check('JSON parcial devolve o que veio', !!parcial?.summary && !parcial?.seoTitle);

// Esqueleto de schema (o bug real dos modelos de raciocínio): {"summary":"string"}
const esqueleto = parseArticleMetadataResponse(
    JSON.stringify({ summary: 'string', seoTitle: 'texto' }),
    ['summary', 'seoTitle']
);
check('rejeita esqueleto de schema', esqueleto === null);

// Cercas de código (o prompt proíbe-as, mas os modelos mandam-nas na mesma).
const cercado = parseArticleMetadataResponse(
    '```json\n{"summary": "Dentro de cercas."}\n```',
    ['summary']
);
check('aceita JSON dentro de cercas', cercado?.summary === 'Dentro de cercas.');

// seoTitle acima do tecto de 60 → tem de ser cortado, não gravado com 95 chars
// (o maxLength do input só bloqueia escrita, não valores programáticos).
const longo = parseArticleMetadataResponse(
    JSON.stringify({ seoTitle: 'a'.repeat(95) }),
    ['seoTitle']
);
check('seoTitle cortado a 60 chars', longo?.seoTitle?.length === 60);

const descLonga = parseArticleMetadataResponse(
    JSON.stringify({ seoDescription: 'b'.repeat(300) }),
    ['seoDescription']
);
check('seoDescription cortado a 160 chars', descLonga?.seoDescription?.length === 160);

// Keywords: duplicadas (case-insensitive), vazias e acima do tecto.
const kw = parseArticleMetadataResponse(
    JSON.stringify({
        keywords: ['IA', 'ia', '  marketing  ', '', '   ', 'x'.repeat(30)],
    }),
    ['keywords']
);
check('keywords: dedup case-insensitive', kw?.keywords?.filter((k) => k.toLowerCase() === 'ia').length === 1);
check('keywords: espaços normalizados', kw?.keywords?.includes('marketing') === true);
check('keywords: vazias removidas', kw?.keywords?.every((k) => k.trim().length > 0) === true);

// Tipo errado: keywords como string (não array).
const kwString = parseArticleMetadataResponse(
    JSON.stringify({ keywords: 'automatização' }),
    ['keywords']
);
check('rejeita keywords que não é array', kwString === null);

// summary como número.
const summaryNum = parseArticleMetadataResponse(
    JSON.stringify({ summary: 42 }),
    ['summary']
);
check('rejeita summary numérico', summaryNum === null);

// Lixo sem JSON nenhum.
check('rejeita lixo sem JSON', parseArticleMetadataResponse('Desculpe, não posso.', todos) === null);
check('rejeita texto vazio', parseArticleMetadataResponse('', todos) === null);
check('rejeita array JSON', parseArticleMetadataResponse('["summary"]', todos) === null);

// ---------------------------------------------------------------------------
// articleMetadataUpdateData
// ---------------------------------------------------------------------------

console.log('\narticleMetadataUpdateData');

// Um campo que falhou NÃO pode virar null: o valor do utilizador fica.
const parcialUpdate = articleMetadataUpdateData({ summary: 'Novo.' });
check('só escreve os campos válidos', Object.keys(parcialUpdate).length === 1);
check(
    'campo em falta não vira null',
    !('seoTitle' in parcialUpdate) && !('keywords' in parcialUpdate)
);
check('update vazio quando nada veio', Object.keys(articleMetadataUpdateData({})).length === 0);

// ---------------------------------------------------------------------------
// isMetadataFieldMissing / missingMetadataFields
// ---------------------------------------------------------------------------

console.log('\nisMetadataFieldMissing');

const vazio = {
    summary: null,
    keywords: [],
    seoTitle: null,
    seoDescription: null,
};
check('tudo em falta num artigo novo', missingMetadataFields(vazio).length === 4);
check('array vazio conta como em falta', isMetadataFieldMissing('keywords', vazio));
check('só espaços conta como em falta', isMetadataFieldMissing('summary', { ...vazio, summary: '   ' }));
check('null conta como em falta', isMetadataFieldMissing('seoTitle', vazio));

const cheio = {
    summary: 'Um resumo real.',
    keywords: ['ia'],
    seoTitle: 'Título',
    seoDescription: 'Descrição',
};
check('artigo completo não tem nada em falta', missingMetadataFields(cheio).length === 0);
check('texto preenchido não está em falta', !isMetadataFieldMissing('seoDescription', cheio));
check('keywords com 1 elemento não está em falta', !isMetadataFieldMissing('keywords', cheio));

// Parcial: o caso do botão "Gerar em falta (2)".
const parcial2 = { ...cheio, summary: null, seoTitle: null };
check(
    'detecta exactamente os 2 em falta',
    JSON.stringify(missingMetadataFields(parcial2)) ===
        JSON.stringify(['summary', 'seoTitle'])
);

// ---------------------------------------------------------------------------
// canGenerateMetadata
// ---------------------------------------------------------------------------

console.log('\ncanGenerateMetadata');

check('body com texto gera', canGenerateMetadata('# Título\n\nTexto.'));
check('body vazio não gera', !canGenerateMetadata(''));
check('body só com espaços não gera', !canGenerateMetadata('   \n\n  '));

// ---------------------------------------------------------------------------

console.log(
    falhas === 0
        ? `\nTodos os ${total} testes passaram.`
        : `\n${falhas} de ${total} testes falharam.`
);
process.exit(falhas === 0 ? 0 : 1);