import type {
    Article,
    ContentFormat,
    ContentSlide,
    Product,
    Workspace,
} from '@/types/database';
import type { PillarConfig } from '@/types/pillar';

// =============================================================================
// Prompts de conteúdo — divididos em system (função + regras + formato) e user
// (contexto da geração). O system de cada formato é o default configurável em
// ai_system_prompts (contentType = formato); o user é sempre construído aqui.
// Também constroem os "prompts portáteis" (por item) guardados em
// content_generation_prompts.
// =============================================================================

interface ContentPromptParams {
    article: Article;
    workspace: Workspace;
    product?: Product;
    pillar?: PillarConfig;
    durationSec?: number;
}

// -----------------------------------------------------------------------------
// Contexto (user prompt) — partilhado por todos os formatos
// -----------------------------------------------------------------------------

export function buildContext(params: ContentPromptParams): string {
    const { article, workspace, product, pillar } = params;

    const language = workspace.contentLanguage || 'pt';
    const languageLabel =
        language === 'pt'
            ? 'português'
            : language === 'en'
              ? 'inglês'
              : language;
    const voiceTone = workspace.voiceTone || 'profissional e acessível';

    let context = `## Contexto\n`;
    context += `Idioma: ${languageLabel}\n`;
    context += `Tom de voz: ${voiceTone}\n`;

    if (workspace.targetAudience) {
        context += `Público-alvo: ${workspace.targetAudience}\n`;
    }

    if (pillar) {
        context += `Pilar: ${pillar.name}\n`;
        if (pillar.objective) {
            context += `Objetivo: ${pillar.objective}\n`;
        }
    }

    if (product) {
        context += `\n## Produto\n`;
        context += `Nome: ${product.name}\n`;
        if (product.problemSolved) {
            context += `Problema que resolve: ${product.problemSolved}\n`;
        }
        if (product.landingUrl) {
            context += `Landing page: ${product.landingUrl}\n`;
        }
    }

    context += `\n## Artigo Original\n`;
    context += `Título: ${article.title}\n`;
    if (article.summary) {
        context += `Resumo: ${article.summary}\n`;
    }
    context += `\nConteúdo:\n${article.body.substring(0, 3000)}\n`;

    return context;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function languageLabelOf(workspace: Workspace): string {
    const language = workspace.contentLanguage || 'pt';
    return language === 'pt'
        ? 'português'
        : language === 'en'
          ? 'inglês'
          : language;
}

function voiceToneOf(workspace: Workspace, fallback = 'profissional e acessível'): string {
    return workspace.voiceTone || fallback;
}

// -----------------------------------------------------------------------------
// System prompts por formato (defaults configuráveis em ai_system_prompts)
// -----------------------------------------------------------------------------

export function buildCarouselSystemPrompt(params: ContentPromptParams): string {
    const language = languageLabelOf(params.workspace);
    const tone = voiceToneOf(params.workspace, 'profissional');

    return `És um especialista em conteúdo visual para LinkedIn.

## Tarefa
Cria um carrossel de slides otimizado para LinkedIn com base no artigo fornecido.

## Requisitos
- Mínimo 5 slides, máximo 10 slides
- Cada slide deve ter um título curto e corpo conciso
- O primeiro slide deve ser um "gancho" atrativo
- O último slide deve ter um CTA forte
- Formato do output deve ser JSON válido:

\`\`\`json
{
  "title": "Título interno do carrossel",
  "slides": [
    {"order": 1, "title": "Título do slide 1", "body": "Corpo do slide 1 (máx 150 caracteres)"},
    {"order": 2, "title": "Título do slide 2", "body": "Corpo do slide 2"},
    ...
  ]
}
\`\`\`

## Instruções
- Escreve em ${language}
- Usa o tom: ${tone}
- Inclui estatísticas ou factos do artigo quando possível
- Faz referência ao produto de forma natural se aplicável
`;
}

export function buildLinkedInPostSystemPrompt(params: ContentPromptParams): string {
    const language = languageLabelOf(params.workspace);
    const tone = voiceToneOf(params.workspace, 'profissional e directo');

    return `És um copywriter especialista em LinkedIn.

## Tarefa
Cria um post opinativo para LinkedIn baseado no artigo.

## Requisitos
- 150-300 palavras
- Começa com um gancho forte (primeira linha que prende atenção)
- Tom profissional mas com opinião pessoal
- Inclui 2-3 hashtags relevantes
- Termina com uma pergunta ou CTA para gerar engagement
- Formato do output deve ser JSON válido:

\`\`\`json
{
  "title": "Título interno do post",
  "body": "Texto completo do post...",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}
\`\`\`

## Instruções
- Escreve em ${language}
- Usa o tom: ${tone}
- Faz uma afirmação forte no início
- Usa quebras de linha para melhorar legibilidade
- Inclui história pessoal ou experiência quando relevante
`;
}

export function buildInstagramPostSystemPrompt(params: ContentPromptParams): string {
    const language = languageLabelOf(params.workspace);

    return `És um copywriter especialista em Instagram.

## Tarefa
Cria um post curto e visual para Instagram baseado no artigo.

## Requisitos
- 50-150 palavras
- Linguagem casual e acessível
- Inclui 5-8 hashtags no final
- Formato do output deve ser JSON válido:

\`\`\`json
{
  "title": "Título interno do post",
  "body": "Texto do post...",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6", "#hashtag7", "#hashtag8"]
}
\`\`\`

## Instruções
- Escreve em ${language}
- Tom: casual e conversacional
- Usa emojis estrategicamente
- Foca num único ponto principal
- Considera o que funcionaria visualmente como caption
`;
}

export function buildShortVideoSystemPrompt(params: ContentPromptParams): string {
    const language = languageLabelOf(params.workspace);

    return `És um especialista em vídeos curtos (TikTok/Reels).

## Tarefa
Cria um gancho e CTA para um vídeo curto (TikTok/Reels) baseado no artigo.

## Requisitos
- Hook: Primeiras 3-5 segundos (texto para aparecer no ecrã + narração)
- CTA: Call to action final (2-3 segundos)
- Formato do output deve ser JSON válido:

\`\`\`json
{
  "title": "Título interno do vídeo",
  "hookText": "Texto do gancho (aparece no ecrã) - máx 15 palavras",
  "ctaText": "Texto do call to action - máx 20 palavras"
}
\`\`\`

## Instruções
- Escreve em ${language}
- O hook deve ser surpreendente, provocador ou utilitário
- O CTA deve ser claro e direccionado
- Considera que o hook aparece antes do utilizador decidir se fica a ver
`;
}

export function buildCtaPostSystemPrompt(params: ContentPromptParams): string {
    const language = languageLabelOf(params.workspace);
    const tone = voiceToneOf(params.workspace, 'directo e convincente');

    return `És um copywriter especialista em conversão no LinkedIn.

## Tarefa
Cria um post directo com call-to-action forte para LinkedIn, baseado no artigo.

## Requisitos
- 80-150 palavras
- Foco na transformação/resultado
- Inclui link para landing page do produto
- CTA claro e urgente (mas não agressivo)
- Formato do output deve ser JSON válido:

\`\`\`json
{
  "title": "Título interno",
  "body": "Texto do post com CTA...",
  "ctaText": "Texto do botão/CTA"
}
\`\`\`

## Instruções
- Escreve em ${language}
- Tom: ${tone}
- Foca nos benefícios, não nas features
- Cria urgência sem ser manipulativo
- O link deve aparecer como placeholder: [LINK]
`;
}

export function buildThreadSystemPrompt(params: ContentPromptParams): string {
    const language = languageLabelOf(params.workspace);

    return `És um especialista em storytelling no X/Twitter.

## Tarefa
Cria uma thread (série de posts) para X/Twitter baseada no artigo.

## Requisitos
- 5-8 tweets
- Cada tweet máx 280 caracteres
- Primeiro tweet é o "gancho" (thread starter)
- Último tweet tem CTA
- Formato do output deve ser JSON válido:

\`\`\`json
{
  "title": "Título interno da thread",
  "tweets": [
    {"order": 1, "text": "Tweet 1 (gancho)..."},
    {"order": 2, "text": "Tweet 2..."},
    {"order": 3, "text": "Tweet 3..."},
    ...
    {"order": 8, "text": "Tweet final com CTA..."}
  ]
}
\`\`\`

## Instruções
- Escreve em ${language}
- Tom: conversacional mas informativo
- Cada tweet deve funcionar isoladamente mas fazer sentido na sequência
- Usa numeração ou marcadores (1/, 2/, etc.) para clareza
- Último tweet: pergunta para engagement ou link
`;
}

export function buildVideoScriptSystemPrompt(params: ContentPromptParams): string {
    const durationSec = params.durationSec || 60;
    const language = languageLabelOf(params.workspace);

    return `És um roteirista de vídeos curtos para redes sociais.

## Tarefa
Cria um roteiro de vídeo curto baseado no artigo.

## Estrutura do Roteiro
1. **Hook (3 segundos)**: Frase impactante que faz o espectador ficar a ver. Pode ser uma pergunta provocadora, dado surpreendente, ou afirmação controversa.
2. **Problema (5-10 segundos)**: Introduz o problema ou dor que o artigo resolve. Faz o espetador identificar-se.
3. **Solução (30-40 segundos)**: Desenvolvimento dos pontos principais do artigo. Linguagem conversacional, como se estivesses a falar com um amigo.
4. **CTA (5-10 segundos)**: Call to action final claro.

## Requisitos Adicionais
- **onScreenText**: Sugestões de texto a aparecer no ecrã (máximo 5). São curtos, complementam o que dizes.
- **bRoll**: Sugestões de imagens/vídeos de fundo para cada secção (máximo 5). Descrições de stock footage ou screencasts.

## Output
O output DEVE ser JSON válido:

\`\`\`json
{
  "title": "Título cativante para o vídeo (máx 60 caracteres)",
  "hook": "Texto do gancho - frase de impacto (máx 15 palavras)",
  "problem": "Descrição do problema ou contexto (5-10 segundos de fala)",
  "solution": "Desenvolvimento da solução com pontos principais (${Math.round(durationSec * 0.6)} segundos de fala aproximadamente)",
  "cta": "Call to action final claro (máx 20 palavras)",
  "fullScript": "Roteiro completo para leitura em voz alta, com indicações de pausa (ex: [PAUSA]), ênfase (ex: *palavra*) e tom (ex: (entusiasmado)). Formato para ser lido diretamente.",
  "durationSec": ${durationSec},
  "onScreenText": ["Texto 1", "Texto 2", "Texto 3"],
  "bRoll": ["Descrição visual 1", "Descrição visual 2"]
}
\`\`\`

## Regras de Escrita
- Escreve em ${language}
- Linguagem natural e conversacional
- O fullScript deve ter aproximadamente ${Math.round(durationSec * 2.5)} palavras (150 palavras/minuto)
- Usa *palavra* para indicar ênfase
- Usa [PAUSA] para indicar pausas dramáticas
- O hook deve surpreender ou criar curiosidade
- O CTA deve ser específico e acionável
`;
}

// -----------------------------------------------------------------------------
// Resolução do system prompt padrão de um formato (default em código)
// -----------------------------------------------------------------------------

export const CONTENT_TYPE_LABELS: Record<string, string> = {
    article: 'Artigo',
    CAROUSEL: 'Carrossel (LinkedIn)',
    LINKEDIN_POST: 'Post LinkedIn',
    IMAGE: 'Post Instagram',
    SHORT_VIDEO: 'Vídeo curto (TikTok/Reels)',
    CTA_POST: 'Post com CTA',
    THREAD: 'Thread (X/Twitter)',
    VIDEO_SCRIPT: 'Roteiro de vídeo',
};

export function buildSystemPromptForFormat(
    format: ContentFormat,
    params: ContentPromptParams
): string {
    switch (format) {
        case 'CAROUSEL':
            return buildCarouselSystemPrompt(params);
        case 'LINKEDIN_POST':
            return buildLinkedInPostSystemPrompt(params);
        case 'IMAGE':
            return buildInstagramPostSystemPrompt(params);
        case 'SHORT_VIDEO':
            return buildShortVideoSystemPrompt(params);
        case 'CTA_POST':
            return buildCtaPostSystemPrompt(params);
        case 'THREAD':
            return buildThreadSystemPrompt(params);
        case 'VIDEO_SCRIPT':
            return buildVideoScriptSystemPrompt(params);
        default:
            return buildLinkedInPostSystemPrompt(params);
    }
}

// -----------------------------------------------------------------------------
// Prompt completo (system + user) — compatibilidade/auditoria
// -----------------------------------------------------------------------------

export function buildPromptForFormat(
    format: ContentFormat,
    params: ContentPromptParams
): string {
    return `${buildSystemPromptForFormat(format, params)}\n\n${buildContext(params)}`;
}

export function buildVideoScriptPrompt(params: ContentPromptParams): string {
    return `${buildVideoScriptSystemPrompt(params)}\n\n${buildContext(params)}`;
}

// -----------------------------------------------------------------------------
// Prompts portáteis (final, self-contained) por item — guardados em
// content_generation_prompts. Recriam exatamente o item gerado: system +
// contexto + foco no item.
// -----------------------------------------------------------------------------

function buildPortablePrompt(
    params: ContentPromptParams,
    systemPrompt: string,
    itemKey: string,
    itemTitle: string | null,
    itemText: string
): string {
    const label = itemTitle ? `${itemKey} — ${itemTitle}` : itemKey;

    return `${systemPrompt}

${buildContext(params)}

## Item específico a gerar (${label.replace(/\|/g, '')})
${itemText.trim()}

Este é um item de uma peça maior. Gera apenas este item, com o formato e tom
descritos acima, sem incluir nenhum outro item.
`;
}

/** Prompt portátil de um item de carrossel (slide). */
export function buildCarouselItemPortablePrompt(
    params: ContentPromptParams,
    slide: ContentSlide,
    index: number
): string {
    const total = params.article ? 'carrossel' : 'carrossel';
    const body = slide.body || '';
    const title = `Slide ${slide.order ?? index + 1} (${total})`;
    return buildPortablePrompt(
        params,
        buildCarouselSystemPrompt(params),
        `slide-${slide.order ?? index + 1}`,
        title,
        slide.title ? `Título: ${slide.title}\n\n${body}` : body
    );
}

/** Prompt portátil de um tweet de thread. */
export function buildThreadItemPortablePrompt(
    params: ContentPromptParams,
    tweet: { order: number; text: string },
): string {
    return buildPortablePrompt(
        params,
        buildThreadSystemPrompt(params),
        `tweet-${tweet.order}`,
        null,
        tweet.text
    );
}

/** Prompt portátil de uma peça de item único (ou video script). */
export function buildSingleItemPortablePrompt(
    format: ContentFormat,
    params: ContentPromptParams,
    title: string | null,
    body: string
): string {
    return buildPortablePrompt(
        params,
        buildSystemPromptForFormat(format, params),
        'main',
        title,
        body
    );
}

// -----------------------------------------------------------------------------
// Parsers (inalterados)
// -----------------------------------------------------------------------------

export function parseCarouselResponse(text: string): {
    title: string | null;
    slides: ContentSlide[];
} | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);
        const slides = parsed.slides || [];

        return {
            title: parsed.title || null,
            slides: slides.map(
                (
                    s: { order?: number; title: string; body: string },
                    i: number
                ) => ({
                    order: s.order || i + 1,
                    title: s.title || '',
                    body: s.body || '',
                })
            ),
        };
    } catch {
        return null;
    }
}

export function parseLinkedInPostResponse(text: string): {
    title: string | null;
    body: string;
    hashtags: string[];
} | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            title: parsed.title || null,
            body: parsed.body || '',
            hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        };
    } catch {
        return null;
    }
}

export function parseInstagramPostResponse(text: string): {
    title: string | null;
    body: string;
    hashtags: string[];
} | null {
    return parseLinkedInPostResponse(text);
}

export function parseShortVideoResponse(text: string): {
    title: string | null;
    hookText: string | null;
    ctaText: string | null;
} | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            title: parsed.title || null,
            hookText: parsed.hookText || null,
            ctaText: parsed.ctaText || null,
        };
    } catch {
        return null;
    }
}

export function parseCtaPostResponse(text: string): {
    title: string | null;
    body: string;
    ctaText: string | null;
} | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            title: parsed.title || null,
            body: parsed.body || '',
            ctaText: parsed.ctaText || null,
        };
    } catch {
        return null;
    }
}

export function parseThreadResponse(text: string): {
    title: string | null;
    tweets: Array<{ order: number; text: string }>;
} | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);
        const tweets = parsed.tweets || [];

        return {
            title: parsed.title || null,
            tweets: tweets.map(
                (t: { order?: number; text: string }, i: number) => ({
                    order: t.order || i + 1,
                    text: t.text || '',
                })
            ),
        };
    } catch {
        return null;
    }
}

export interface ParsedVideoScript {
    title: string | null;
    hook: string | null;
    problem: string | null;
    solution: string | null;
    cta: string | null;
    fullScript: string | null;
    durationSec: number;
    onScreenText: string[];
    bRoll: string[];
}

export function parseVideoScriptResponse(text: string): ParsedVideoScript | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            title: parsed.title || null,
            hook: parsed.hook || null,
            problem: parsed.problem || null,
            solution: parsed.solution || null,
            cta: parsed.cta || null,
            fullScript: parsed.fullScript || null,
            durationSec: parsed.durationSec || 60,
            onScreenText: Array.isArray(parsed.onScreenText)
                ? parsed.onScreenText
                : [],
            bRoll: Array.isArray(parsed.bRoll)
                ? parsed.bRoll
                : [],
        };
    } catch {
        return null;
    }
}