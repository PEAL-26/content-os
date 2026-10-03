import type { Article, ContentFormat, Product, Workspace } from '@/types/database';
import type { PillarConfig } from '@/types/pillar';

// =============================================================================
// "Gerar apenas o prompt" — meta-prompting.
//
// A IA escreve o PROMPT que vai gerar a peça, em vez de escrever a peça. O
// prompt resultante é guardado em `content_generation_prompts` (itemKey 'main'),
// passa a ser editável/copriável pelo utilizador e é o que vai na mensagem de
// geração quando ele carregar em "Gerar peça".
//
// Ficheiro puro (sem imports de runtime), partilhado por client e servidor.
// O system prompt do escritor é configurável em `ai_system_prompts` com
// contentType = `prompt_<FORMATO>` (workspace > utilizador > default aqui).
// =============================================================================

/** Prefixo do contentType em `ai_system_prompts` para o escritor de prompts. */
export const PROMPT_WRITER_PREFIX = 'prompt_';

/** Formatos com escritor de prompt (os que o painel de conteúdo oferece). */
export const PROMPT_WRITER_FORMATS: ContentFormat[] = [
    'CAROUSEL',
    'LINKEDIN_POST',
    'IMAGE',
    'SHORT_VIDEO',
    'CTA_POST',
    'THREAD',
    'VIDEO_SCRIPT',
];

/** contentType do system prompt do escritor para um formato. */
export function promptWriterContentType(format: ContentFormat): string {
    return `${PROMPT_WRITER_PREFIX}${format}`;
}

// -----------------------------------------------------------------------------
// Especificação do que a peça final vai ser (o que o prompt tem de exigir para
// a geração resultante ter o formato certo).
// -----------------------------------------------------------------------------

interface FormatSpec {
    label: string;
    /** O que a peça final é, em uma frase. */
    output: string;
    /** Regras estruturais que o prompt deve fixar. */
    rules: string[];
}

/** Label por formato (espelha CONTENT_FORMAT_LABELS, sem dependência). */
export const PROMPT_WRITER_FORMAT_LABELS: Record<ContentFormat, string> = {
    CAROUSEL: 'Carrossel',
    LINKEDIN_POST: 'Post LinkedIn',
    IMAGE: 'Post visual de Instagram',
    SHORT_VIDEO: 'Vídeo curto',
    CTA_POST: 'Post com CTA',
    THREAD: 'Thread',
    VIDEO_SCRIPT: 'Roteiro de vídeo',
};

const FORMAT_SPECS: Record<ContentFormat, FormatSpec> = {
    CAROUSEL: {
        label: 'Carrossel de LinkedIn',
        output:
            'um carrossel de slides (o sistema pede entre 5 e 10 slides, com título e corpo por slide, JSON)',
        rules: [
            'Define slide a slide o que vai em cada um (o slide 1 é o gancho, o último é o CTA)',
            'Cada slide tem um título curto e um corpo de no máximo ~150 caracteres',
            'Indica a tese/ângulo de cada slide, não o texto final palavra por palavra',
            'Deve incluir um CTA final claro',
        ],
    },
    LINKEDIN_POST: {
        label: 'Post de LinkedIn',
        output:
            'um post opinativo de LinkedIn (o sistema pede 150-300 palavras com gancho, corpo e 2-3 hashtags, JSON)',
        rules: [
            'Define a tese/opinião central e o gancho da primeira linha',
            'Define a estrutura (o que se diz em cada parágrafo) e o fecho com pergunta ou CTA',
            'Indica que hashtags (2-3) são esperadas no fim',
        ],
    },
    IMAGE: {
        label: 'Post visual de Instagram',
        output:
            'um post de Instagram (o sistema pede 50-150 palavras de caption, tom conversacional, 5-8 hashtags, JSON)',
        rules: [
            'Foca num único ponto principal: o que é que se vê e o que fica escrito na imagem',
            'O texto que vai SOBREPOSTO na imagem tem de ser curtíssimo — escreve-o literalmente, few words, máximo ~10 palavras no total',
            'A caption (50-150 palavras) explica e dá contexto ao que está na imagem',
            'Indica o visual/conceito da imagem (o que se vê) de forma concreta',
        ],
    },
    SHORT_VIDEO: {
        label: 'Vídeo curto (TikTok/Reels)',
        output:
            'um vídeo curto (o sistema pede só o gancho dos primeiros 3-5 segundos e o CTA final, JSON)',
        rules: [
            'Foca quase tudo no gancho: define o que é dito/mostrado nos primeiros 3 segundos',
            'O gancho tem de ser dito em no máximo ~15 palavras e o CTA em ~20',
            'Sugere o visual dos primeiros segundos (o que aparece no ecrã)',
        ],
    },
    CTA_POST: {
        label: 'Post de conversão com CTA',
        output:
            'um post directo com CTA (o sistema pede 80-150 palavras, transformação/resultado e link [LINK], JSON)',
        rules: [
            'Define a transformação prometida e para quem é',
            'Indica o link como [LINK] (o sistema preenche a landing page)',
            'O CTA tem de ser explícito e accionável',
        ],
    },
    THREAD: {
        label: 'Thread de X/Twitter',
        output:
            'uma thread (o sistema pede tweets encadeados, JSON, separados por linha em branco no body)',
        rules: [
            'Define tweet a tweet o que se diz (o primeiro é o gancho, o último é o CTA)',
            'Cada tweet tem de caber num post curto — escreve o texto de cada tweet ou o seu limite',
            'Mantém uma linha narrativa coerente do início ao fim',
        ],
    },
    VIDEO_SCRIPT: {
        label: 'Roteiro de vídeo',
        output:
            'um roteiro de vídeo curto (o sistema pede gancho, problema, solução, CTA e o roteiro completo, JSON)',
        rules: [
            'Define o gancho (3 primeiros segundos), o problema, a solução e o CTA final',
            'Indica a duração alvo e o tom de leitura',
        ],
    },
};

function languageLabelOf(workspace: Workspace): string {
    const language = workspace.contentLanguage || 'pt';
    if (language === 'pt') return 'português';
    if (language === 'en') return 'inglês';
    if (language === 'es') return 'espanhol';
    if (language === 'fr') return 'francês';
    return language;
}

function voiceToneOf(workspace: Workspace, fallback: string): string {
    return workspace.voiceTone || fallback;
}

/** Teto do corpo do artigo que entra no brief (o prompt tem de ser copiável). */
const ARTICLE_BODY_LIMIT = 12_000;

// -----------------------------------------------------------------------------
// System prompt do escritor (default em código, sobrescrevível em Definições)
// -----------------------------------------------------------------------------

export function buildPromptWriterSystemPrompt(
    format: ContentFormat,
    params: { workspace: Workspace; product?: Product }
): string {
    const spec = FORMAT_SPECS[format];
    const language = languageLabelOf(params.workspace);
    const tone = voiceToneOf(params.workspace, 'profissional e acessível');
    const productLine = params.product?.name
        ? `O produto em causa é "${params.product.name}".`
        : '';

    return `És um estrategista de conteúdo e prompt engineer. Escreves o PROMPT que vai ser enviado a um modelo de IA para produzir uma peça de conteúdo — não escreves a peça.

## Tarefa
Escreve um único prompt (o briefing) que, enviado a um modelo de IA, vai produzir ${spec.output}.

${productLine}

## O que o prompt final tem de conter
1. **O essencial do artigo, já destilado.** O prompt é autónomo: quem o ler tem de conseguir escrever a peça sem ver o artigo. Condensa o artigo nas mensagens que importam para esta peça — não copies o artigo inteiro, nem faças copy-paste de parágrafos inteiros.
2. **As regras da peça** (as da secção "Regras estruturais" abaixo), adaptadas a este caso.
3. **O contexto certo**: pilar, produto, tom de voz, público-alvo e Canal — só o que for relevante para esta peça.

## Regras estruturais a fixar no prompt (${spec.label})
${spec.rules.map((r) => `- ${r}`).join('\n')}

## Regras de fidelidade (críticas)
- **Não inventes factos, números, estatísticas, citações, nomes ou resultados** que não estejam no artigo. Se o artigo não tem um número, o prompt não pode inventar um.
- **Não adiciones informação de fora** (tendências, novidades, opinião externa). O que não está no artigo, não entra.
- **Mantém a tese do artigo.** Não mudes o sentido nem transformes o artigo noutro tema.
- Podes organizar, cortar, focar e priorizar — nunca distorcer.

## Como escrever o prompt
- Escreve o prompt em **markdown**, com títulos de secção curtos (ex.: \`## Contexto\`, \`## O que dizer\`, \`## Estrutura\`, \`## CTA\`).
- **Português ${language}**, a partir de agora e no prompt final.
- Tom a respeitar dentro do prompt: ${tone}.
- O prompt final é **instrução directa para um modelo** ("Escreve…", "Cria…"), não descrição do que pediste. Nunca escrevas meta-comentário do tipo "Aqui está o prompt:" ou "espero que ajude".
- Devolve **só o prompt**, sem cercas de código (\`\`\`) à volta, sem prefácio e sem explicação.

## Formato da resposta
Responde **apenas** com o texto do prompt final, em markdown, sem cercas de código e sem comentários adicionais.`;
}

/** Labels para o editor de prompts de IA (contentType do escritor). */
export const PROMPT_WRITER_LABELS: Record<string, string> = Object.fromEntries(
    PROMPT_WRITER_FORMATS.map((f) => [
        promptWriterContentType(f),
        `Prompt de ${PROMPT_WRITER_FORMAT_LABELS[f]}`,
    ])
);

// -----------------------------------------------------------------------------
// User prompt do escritor — os dados que ele tem de destilar
// -----------------------------------------------------------------------------

export interface PromptWriterParams {
    article: Article;
    workspace: Workspace;
    format: ContentFormat;
    product?: Product;
    pillar?: PillarConfig;
    /** Canal social destino (label legível, ex.: "LinkedIn"). */
    channelLabel?: string | null;
    /** Instruções adicionais escolhidas pelo utilizador no painel. */
    additionalInstructions?: string;
}

export function buildPromptWriterUserPrompt(
    params: PromptWriterParams
): string {
    const { article, workspace, product, pillar, format } = params;
    const spec = FORMAT_SPECS[format];
    const language = languageLabelOf(workspace);

    let ctx = `## Contexto da empresa\n`;
    ctx += `Empresa: ${workspace.name}\n`;
    ctx += `Idioma do conteúdo: ${language}\n`;
    ctx += `Tom de voz: ${voiceToneOf(workspace, 'profissional e acessível')}\n`;
    if (workspace.targetAudience) {
        ctx += `Público-alvo: ${workspace.targetAudience}\n`;
    }
    if (workspace.valueProposition) {
        ctx += `Proposta de valor: ${workspace.valueProposition}\n`;
    }
    if (pillar) {
        ctx += `Pilar de conteúdo: ${pillar.name}\n`;
        if (pillar.objective) {
            ctx += `Objectivo do pilar: ${pillar.objective}\n`;
        }
    }
    if (product) {
        ctx += `\n## Produto\n`;
        ctx += `Nome: ${product.name}\n`;
        if (product.tagline) ctx += `Tagline: ${product.tagline}\n`;
        if (product.problemSolved) {
            ctx += `Problema que resolve: ${product.problemSolved}\n`;
        }
        if (product.targetAudience) {
            ctx += `Público do produto: ${product.targetAudience}\n`;
        }
        if (product.landingUrl) {
            ctx += `Landing page: ${product.landingUrl}\n`;
        }
    }

    ctx += `\n## Peça a preparar\n`;
    ctx += `Formato: ${spec.label}\n`;
    if (params.channelLabel) {
        ctx += `Canal: ${params.channelLabel}\n`;
    }
    ctx += `A peça final será: ${spec.output}\n`;

    ctx += `\n## Artigo original (fonte de verdade — não inventar nada aqui)\n`;
    ctx += `Título: ${article.title}\n`;
    if (article.summary) {
        ctx += `Resumo: ${article.summary}\n`;
    }
    if (article.keywords?.length) {
        ctx += `Keywords: ${article.keywords.join(', ')}\n`;
    }

    const body = article.body || '';
    const truncated = body.length > ARTICLE_BODY_LIMIT;
    const bodyForPrompt = truncated
        ? `${body.substring(0, ARTICLE_BODY_LIMIT)}\n\n[...artigo truncado para brevity — usa só o que está acima...]`
        : body;
    // O artigo é o único texto não-confiável do prompt (vem do utilizador e
    // pode conter headings que imitam as secções de instrução). Delimitado para
    // que "## Tarefa" dentro do artigo não possa reencaminhar o escritor.
    ctx += `\n<artigo>\n${bodyForPrompt}\n</artigo>\n`;

    if (params.additionalInstructions?.trim()) {
        ctx += `\n## Instruções adicionais do utilizador (têm de ser respeitadas no prompt)\n${params.additionalInstructions.trim()}\n`;
    }

    ctx += `\n## Tarefa\n`;
    ctx += `Escreve o prompt final que gera ${spec.label} a partir do artigo acima (o texto entre <artigo> e </artigo>).\n`;
    ctx += `Lembra-te: o prompt é autónomo (não pressupõe que quem o lê viu o artigo), é fiel ao artigo e não inventa factos.\n`;

    return ctx;
}

// -----------------------------------------------------------------------------
// Parse da resposta do escritor
// -----------------------------------------------------------------------------

/**
 * Valores-placeholder típicos de um esqueleto de schema (`"string"`, `"texto"`,
 * `"número"`, …). Um prompt real nunca é um JSON só com isto.
 */
const PLACEHOLDER_LEAVES = new Set([
    'string',
    'strings',
    'texto',
    'text',
    'exemplo',
    'ex.',
    'exemplos',
    'numero',
    'número',
    'number',
    'integer',
    'int',
    'float',
    'boolean',
    'bool',
    'true',
    'false',
    'null',
    'none',
    'nada',
    'array',
    'lista',
    'list',
    'objeto',
    'object',
    'a definir',
    'a preencher',
    'x',
    'y',
    'z',
]);

function isPlaceholderLeaf(v: unknown): boolean {
    if (typeof v === 'number' || typeof v === 'boolean') return true;
    if (typeof v !== 'string') return false;
    return PLACEHOLDER_LEAVES.has(v.trim().toLowerCase());
}

/**
 * Detecta a resposta em que o modelo devolve o ESQUELETO do formato em vez do
 * prompt pedido — por exemplo:
 *
 * ```json
 * { "hook": "string", "body": "string", "cta": "string", "hashtags": ["string"] }
 * ```
 *
 * Ocorre de forma intermitente nos modelos de raciocínio (o `nemotron-3-ultra`
 * alterna entre escrever o prompt e devolver o schema). Antes disto o parse
 * aceitava o esqueleto como prompt válido: o `maxAttempts: 2` nunca disparava
 * porque o parse "passava", e o esqueleto era gravado em
 * `content_generation_prompts` e aberto ao utilizador como se fosse o prompt.
 *
 * Rejeitar aqui devolve `null` — o que reativa o retry e, se também falhar, o
 * retry de provider. O erro visível passa a ser "a IA não devolveu um prompt
 * válido" em vez de um prompt inutilizável.
 *
 * Só rejeita JSON cujas folhas são TODAS placeholders: um prompt legítimo é
 * markdown e nem sequer parseia como JSON, logo não há falso positivo.
 */
function looksLikeSchemaSkeleton(text: string): boolean {
    const trimmed = text.trim().replace(/^```[a-zA-Z0-9_-]*[ \t\r]*\n?|```$/g, '').trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;

    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return false;
    }

    let leaves = 0;
    let placeholders = 0;
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (node && typeof node === 'object') {
            Object.values(node as Record<string, unknown>).forEach(walk);
            return;
        }
        leaves += 1;
        if (isPlaceholderLeaf(node)) placeholders += 1;
    };
    walk(parsed);

    // Tem de haver folhas e ser TODO placeholder.
    return leaves > 0 && placeholders === leaves;
}

/**
 * Remove cercas de código e meta-comentário envelope, devolve o prompt.
 *
 * Tolerante de propósito: mesmo com o system prompt a proibir cercas e
 * meta-comentário, um modelo pode devolver "Claro! Aqui está o prompt:" seguido
 * do prompt em cercas, ou um fecho de cortesia no fim. Nada disso pode vazar
 * para a caixa de texto editável do utilizador.
 */
export function parseWrittenPrompt(text: string): string | null {
    if (!text) return null;

    let out = text.trim();

    // Remove a cerca de código que envolve o prompt. Sem âncora no fim, para
    // também apanhar o caso "```markdown\n…\n```\n\nEis a explicação final."
    const fenced = out.match(/```[a-zA-Z0-9_-]*[ \t\r]*\n([\s\S]*?)```/);
    if (fenced) {
        out = fenced[1].trim();
    }

    // Meta-comentário inicial ("Claro! Aqui está o prompt:", "Here is the
    // prompt:"). Ancorado à PRIMEIRA linha e ao rótulo "prompt" — nunca
    // avança para a segunda linha, para não comer o início do prompt válido.
    out = out.replace(
        /^(?:[^\n]{0,40}\b(?:claro|certo|bom|beleza|pronto|sure|here|of course)\b[^\n]{0,60}\n)?[^\n]{0,120}\b(?:o |the )?prompt(?: final)?(?: that will generate[^:\n]*)?\s*:\s*\n+/i,
        ''
    );

    // Fecho de cortesia no fim ("Espero que ajude!", "Let me know if…").
    out = out.replace(
        /\n{2,}(?:espero que|se precisar|let me know|let me know if|hope this helps|please let me know)[\s\S]*$/i,
        ''
    );

    out = out.trim();

    if (looksLikeSchemaSkeleton(out)) return null;

    if (out.length < 40) return null;
    return out;
}
