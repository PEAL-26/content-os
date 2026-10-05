import type { MetadataField } from './generation-job-types.js';
import type { Article, Product, Workspace } from '@/types/database';
import type { PillarConfig } from '@/types/pillar';

// =============================================================================
// Metadados do artigo (job ARTICLE_METADATA) — prompts + parse.
//
// Ficheiro puro (sem imports de runtime), partilhado pelo servidor (job Inngest)
// e pelo browser (rótulos, predicado "em falta" e ecrãs). O system prompt é
// configurável em `ai_system_prompts` com contentType = `article_metadata`
// (workspace > utilizador > default aqui).
//
// Regra do projecto: o corpo do artigo é o ÚNICO texto não-confiável do prompt.
// Vem do utilizador e pode conter headings que imitam as secções de instrução,
// por isso vai delimitado — sem isto, um "## Tarefa" dentro do artigo poderia
// reencaminhar o modelo (mesma defesa de `prompt-writer.ts`).
// =============================================================================

/** contentType do system prompt em `ai_system_prompts` para os metadados. */
export const ARTICLE_METADATA_CONTENT_TYPE = 'article_metadata';

/** Campos geráveis, por ordem de apresentação na UI. */
export const METADATA_FIELDS: MetadataField[] = [
    'summary',
    'keywords',
    'seoTitle',
    'seoDescription',
];

/** Labels por campo (confirmação "o que vai ser substituído"). */
export const METADATA_FIELD_LABELS: Record<MetadataField, string> = {
    summary: 'Resumo',
    keywords: 'Keywords',
    seoTitle: 'Meta title',
    seoDescription: 'Meta description',
};

/** Tectos por campo — espelham os `maxLength` da UI e o contrato do artigo. */
const FIELD_LIMITS: Record<Exclude<MetadataField, 'keywords'>, number> = {
    summary: 300,
    seoTitle: 60,
    seoDescription: 160,
};

/** Tecto de keywords (o `NEW_ARTICLE` pede 5; aqui damos margem). */
const KEYWORDS_LIMIT = 10;

/** Teto do corpo que entra no prompt (o artigo truncado ainda dá contexto). */
const ARTICLE_BODY_LIMIT = 12_000;

// -----------------------------------------------------------------------------
// Predicado "em falta" — fonte única para os botões e para o guard do editor
// -----------------------------------------------------------------------------

/** Os valores dos 4 campos, tal como o editor os tem em memória. */
export type ArticleMetadataValues = Pick<
    Article,
    'summary' | 'keywords' | 'seoTitle' | 'seoDescription'
>;

/**
 * Um campo está "em falta" quando não tem conteúdo útil.
 *
 * `trim()` conta: um `summary` só com espaços é tão inútil como `null`, e o
 * editor converte texto vazio em `null` mas nunca produz espaços — um `summary`
 * com espaços só viria de outro caminho de escrita.
 */
export function isMetadataFieldMissing(
    field: MetadataField,
    values: ArticleMetadataValues
): boolean {
    if (field === 'keywords') {
        return (values.keywords?.length ?? 0) === 0;
    }
    return !values[field]?.trim();
}

/** Os campos em falta, pela ordem de `METADATA_FIELDS`. */
export function missingMetadataFields(
    values: ArticleMetadataValues
): MetadataField[] {
    return METADATA_FIELDS.filter((f) => isMetadataFieldMissing(f, values));
}

/** O artigo precisa de corpo para que os metadados derivem de alguma coisa. */
export function canGenerateMetadata(body: string): boolean {
    return body.trim().length > 0;
}

// -----------------------------------------------------------------------------
// System prompt (default em código, sobrescrevível em Definições de IA)
// -----------------------------------------------------------------------------

function languageLabelOf(workspace: Workspace): string {
    const language = workspace.contentLanguage || 'pt';
    if (language === 'pt') return 'português';
    if (language === 'en') return 'inglês';
    if (language === 'es') return 'espanhol';
    if (language === 'fr') return 'francês';
    return language;
}

export function buildArticleMetadataSystemPrompt(params: {
    workspace: Workspace;
}): string {
    const { workspace } = params;
    const language = languageLabelOf(workspace);
    const tone = workspace.voiceTone || 'profissional e acessível';

    let prompt = `És um especialista em SEO que escreve metadados de artigo a partir do texto que o autor já escreveu.\n\n`;

    prompt += `## Requisitos de Formato\n`;
    prompt += `Responde APENAS com JSON válido, sem texto adicional e sem cercas de código:\n`;
    prompt += `{\n`;
    prompt += `  "summary": "resumo do artigo (1-2 frases, max ${FIELD_LIMITS.summary} chars)",\n`;
    prompt += `  "keywords": ["termo1", "termo2", "termo3", "termo4", "termo5"],\n`;
    prompt += `  "seoTitle": "titulo para os resultados de busca (max ${FIELD_LIMITS.seoTitle} chars)",\n`;
    prompt += `  "seoDescription": "descricao meta (max ${FIELD_LIMITS.seoDescription} chars)"\n`;
    prompt += `}\n`;
    prompt += `Devolve APENAS as chaves que foram pedidas na mensagem. Se uma chave pedida não vier, é porque não a escreveste — mas escreve sempre todas as que pedem.\n`;

    prompt += `\n## Instruções\n`;
    prompt += `- Escreve em ${language}\n`;
    prompt += `- Usa o tom: ${tone}\n`;
    prompt += `- Baseia-te **exclusivamente** no artigo fornecido. Não inventes factos, números, estatísticas, citações ou resultados que lá não estejam\n`;
    prompt += `- Não inventes informação ao resumir: se o artigo não tem um número, um cliente ou um caso concreto, o metadado também não tem\n`;
    prompt += `- O \`seoTitle\` é para a página de resultados: inclui o termo principal de forma natural, sem repetir o título do artigo nem usar títulos artificiais ("Melhor", "Guia Definitivo", …)\n`;
    prompt += `- O \`seoDescription\` é uma frase que convence a clicar e explica o que o leitor vai encontrar\n`;
    prompt += `- As \`keywords\` são termos pelos quais uma pessoa pesquisaria este artigo (3 a 8 termos), em minúsculas, sem acentos desnecessários\n`;
    prompt += `- Escreve os metadados no mesmo idioma do artigo, independentemente do idioma da interface\n`;

    return prompt;
}

// -----------------------------------------------------------------------------
// User prompt — o contexto desta geração
// -----------------------------------------------------------------------------

export interface ArticleMetadataPromptParams {
    article: Article;
    workspace: Workspace;
    pillar?: PillarConfig;
    product?: Product;
    /** Campos pedidos nesta geração (o modelo só escreve estes). */
    fields: MetadataField[];
}

export function buildArticleMetadataUserPrompt(
    params: ArticleMetadataPromptParams
): string {
    const { article, workspace, pillar, product, fields } = params;
    const language = languageLabelOf(workspace);

    let prompt = `## Contexto da empresa\n`;
    prompt += `Idioma do conteúdo: ${language}\n`;
    prompt += `Tom de voz: ${workspace.voiceTone || 'profissional e acessível'}\n`;
    if (workspace.targetAudience) {
        prompt += `Público-alvo: ${workspace.targetAudience}\n`;
    }
    if (workspace.valueProposition) {
        prompt += `Proposta de valor: ${workspace.valueProposition}\n`;
    }

    prompt += `\n## Pilar de conteúdo\n`;
    if (pillar) {
        prompt += `Nome: ${pillar.name}\n`;
        if (pillar.objective) {
            prompt += `Objectivo: ${pillar.objective}\n`;
        }
    } else {
        prompt += `Não definido (artigo genérico)\n`;
    }

    prompt += `\n## Produto relacionado\n`;
    if (product) {
        prompt += `Nome: ${product.name}\n`;
        if (product.problemSolved) {
            prompt += `Problema que resolve: ${product.problemSolved}\n`;
        }
    } else {
        prompt += `Nenhum produto associado\n`;
    }

    prompt += `\n## Artigo (fonte da verdade — não inventes nada aqui)\n`;
    prompt += `Título: ${article.title}\n`;

    const body = article.body || '';
    const truncated = body.length > ARTICLE_BODY_LIMIT;
    const bodyForPrompt = truncated
        ? `${body.substring(0, ARTICLE_BODY_LIMIT)}\n\n[...artigo truncado — usa só o que está acima...]`
        : body;
    prompt += `\n<artigo>\n${bodyForPrompt}\n</artigo>\n`;

    prompt += `\n## Metadados a escrever\n`;
    prompt += `Escreve APENAS estes campos, em JSON, com estas regras específicas:\n`;
    for (const field of fields) {
        prompt += `- \`${field}\` (${METADATA_FIELD_LABELS[field]}): ${FIELD_RULES[field]}\n`;
    }

    return prompt;
}

/** Regra específica por campo, escrita para o prompt do utilizador. */
const FIELD_RULES: Record<MetadataField, string> = {
    summary: `1-2 frases (máx ${FIELD_LIMITS.summary} chars) que digam do que trata o artigo.`,
    keywords: `3 a ${KEYWORDS_LIMIT} termos de pesquisa reais, em minúsculas, separados, sem repetir.`,
    seoTitle: `máx ${FIELD_LIMITS.seoTitle} chars. Deve ser diferente do título do artigo e funcionar como título de resultado de busca.`,
    seoDescription: `1 frase (máx ${FIELD_LIMITS.seoDescription} chars) que gere o clique.`,
};

// -----------------------------------------------------------------------------
// Parse da resposta
// -----------------------------------------------------------------------------

/** Valores-placeholder típicos de um esqueleto de schema. */
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
    'palavra',
    'palavras',
    'keyword',
    'keywords',
    'term',
    'termo',
    'none',
    'null',
    'nada',
]);

function isPlaceholderLeaf(v: unknown): boolean {
    if (typeof v === 'number' || typeof v === 'boolean') return true;
    if (typeof v !== 'string') return false;
    return PLACEHOLDER_LEAVES.has(v.trim().toLowerCase());
}

/** Remove cercas de código e devolve o JSON. */
function stripFences(text: string): string {
    const fenced = text.trim().match(/```[a-zA-Z0-9_-]*[ \t\r]*\n([\s\S]*?)```/);
    return (fenced ? fenced[1] : text).trim();
}

/** Normaliza as keywords: trim, sem vazios, sem duplicados, com tecto. */
function parseKeywords(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;

    const seen = new Set<string>();
    const out: string[] = [];

    for (const raw of value) {
        if (typeof raw !== 'string') continue;
        const kw = raw.trim().replace(/\s+/g, ' ');
        if (!kw || isPlaceholderLeaf(kw)) continue;
        const key = kw.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(kw);
        if (out.length >= KEYWORDS_LIMIT) break;
    }

    return out.length > 0 ? out : null;
}

/** Normaliza um campo de texto: trim, colapsa espaços, corta no tecto. */
function parseText(value: unknown, limit: number): string | null {
    if (typeof value !== 'string') return null;
    const text = value.trim().replace(/\s+/g, ' ');
    if (!text) return null;
    // Um placeholder ("string", "texto") é o modelo a devolver o esquema em vez
    // do conteúdo — rejeitar para o campo ficar FAILED em vez de gravar lixo.
    if (isPlaceholderLeaf(text)) return null;
    return text.slice(0, limit);
}

/** Valores válidos por campo — só os pedidos, para o parse não inventar. */
export type ParsedArticleMetadata = Partial<{
    summary: string;
    keywords: string[];
    seoTitle: string;
    seoDescription: string;
}>;

/**
 * Interpreta a resposta da IA para N campos pedidos.
 *
 * Devolve **apenas** os campos pedidos que vieram válidos — o modelo pode
 * devolver o JSON completo e o resto é ignorado. Um campo que venha em falta ou
 * inválido simplesmente não aparece no resultado, e quem chama marca-o FAILED
 * com base nesta ausência. Por isso `parse` nunca devolve `null` enquanto pelo
 * menos um campo vier bem (devolver `null` reativa o retry do modelo inteiro).
 */
export function parseArticleMetadataResponse(
    text: string,
    fields: MetadataField[]
): ParsedArticleMetadata | null {
    const raw = stripFences(text ?? '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        return null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const row = parsed as Record<string, unknown>;

    const out: ParsedArticleMetadata = {};

    for (const field of fields) {
        if (field === 'keywords') {
            const keywords = parseKeywords(row.keywords);
            if (keywords) out.keywords = keywords;
            continue;
        }
        const value = parseText(row[field], FIELD_LIMITS[field]);
        if (value) out[field] = value;
    }

    return Object.keys(out).length > 0 ? out : null;
}

/**
 * Monta o `data` do `prisma.article.update` só com os campos que vieram bem.
 *
 * Devolve um objecto vazio em vez de escrever `null` num campo que falhou —
 * um campo que a IA não conseguiu gerar continua como o utilizador o tinha.
 */
export function articleMetadataUpdateData(
    parsed: ParsedArticleMetadata
): Record<string, string | string[]> {
    const data: Record<string, string | string[]> = {};
    if (parsed.summary) data.summary = parsed.summary;
    if (parsed.seoTitle) data.seoTitle = parsed.seoTitle;
    if (parsed.seoDescription) data.seoDescription = parsed.seoDescription;
    if (parsed.keywords?.length) data.keywords = parsed.keywords;
    return data;
}