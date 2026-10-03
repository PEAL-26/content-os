import { parseWrittenPrompt } from '../src/lib/ai/prompt-writer.js';

// Teste do guard de `parseWrittenPrompt` contra o esqueleto de schema que os
// modelos de raciocinio devolvem por vezes em vez do prompt pedido.
// Sem este guard o esqueleto era aceite, o `maxAttempts: 2` nunca disparava e o
// JSON chegava ao utilizador como se fosse o prompt final.
//
// Correr: npx tsx scripts/probe-prompt-writer-parse.ts
type Case = { nome: string; entrada: string; esperado: 'ACEITA' | 'REJEITA' };

const casos: Case[] = [
    {
        nome: 'schema de peca (o bug real observado)',
        entrada: `{\n  "hook": "string",\n  "body": "string",\n  "cta": "string",\n  "hashtags": ["string", "string", "string"]\n}`,
        esperado: 'REJEITA',
    },
    {
        nome: 'schema de artigo',
        entrada: `{ "title": "string", "slug": "string", "body": "string", "keywords": ["string"] }`,
        esperado: 'REJEITA',
    },
    {
        nome: 'schema dentro de cercas',
        entrada: '```json\n{ "hook": "string", "body": "string", "cta": "string", "hashtags": ["string"] }\n```',
        esperado: 'REJEITA',
    },
    {
        nome: 'schema com numeros/booleanos',
        entrada: `{ "a": 1, "b": true, "c": null }`,
        esperado: 'REJEITA',
    },
    {
        nome: 'PROMPT REAL em markdown',
        entrada:
            '## Contexto\n- **Empresa**: PEAL\n- **Público-alvo**: donos de PME\n\n## O que dizer\n' +
            '- Tese: o marketing de conteudo e o ativo mais durouro\n- Argumento 1: custo dilui-se no tempo\n\n' +
            '## CTA\nConvida o leitor a marcar a empresa.',
        esperado: 'ACEITA',
    },
    {
        nome: 'PROMPT REAL com hashtag literal',
        entrada:
            '## Contexto\nEmpresa PEAL.\n\n## Regras\n- Termina com 2-3 hashtags, por exemplo #marketing #pmes\n' +
            '- Escreve 150-300 palavras em portugues de Portugal, com gancho forte na primeira linha.\n',
        esperado: 'ACEITA',
    },
    {
        nome: 'PROMPT REAL em cercas markdown',
        entrada: '```markdown\n## Contexto\nEscreve sobre marketing de conteudo para PMEs.\n\n## CTA\nQuestiona o leitor.\n```',
        esperado: 'ACEITA',
    },
    {
        nome: 'meta-comentario + prompt',
        entrada:
            'Claro! Aqui está o prompt:\n## Contexto\nEscreve um post de LinkedIn sobre marketing de conteudo para pequenas empresas.',
        esperado: 'ACEITA',
    },
    {
        nome: 'JSON com conteudo REAL (nao e esqueleto)',
        entrada:
            '{ "hook": "Sabe those horas que gastas em tarefas sem resultado?", "hashtags": ["#marketing"] }',
        esperado: 'ACEITA',
    },
    { nome: 'vazio', entrada: '', esperado: 'REJEITA' },
    { nome: 'curto demais', entrada: 'OK', esperado: 'REJEITA' },
];

let falhas = 0;
for (const c of casos) {
    const got = parseWrittenPrompt(c.entrada);
    const obtido = got ? 'ACEITA' : 'REJEITA';
    const ok = obtido === c.esperado;
    if (!ok) falhas += 1;
    console.log(
        `${ok ? 'PASS' : 'FALHA'}  ${c.nome.padEnd(48)} esperado=${c.esperado} obtido=${obtido}`
    );
}
console.log(`\n${casos.length - falhas}/${casos.length} passaram`);
if (falhas > 0) process.exit(1);