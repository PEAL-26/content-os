import type {
    Article,
    ContentFormat,
    ContentSlide,
    Product,
    Workspace,
} from '@/types/database';
import type { PillarConfig } from '@/types/pillar';

interface ContentPromptParams {
    article: Article;
    workspace: Workspace;
    product?: Product;
    pillar?: PillarConfig;
}

function buildContext(params: ContentPromptParams): string {
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

export function buildCarouselPrompt(params: ContentPromptParams): string {
    const context = buildContext(params);

    return `${context}

## Tarefa
Cria um carrossel de slides otimizado para LinkedIn com base no artigo acima.

Requisitos:
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

Instruções:
- Escreve em ${context.includes('Idioma: português') ? 'português' : 'inglês'}
- Usa o tom: ${context.includes('Tom de voz:') ? context.match(/Tom de voz: (.+)/)?.[1] || 'profissional' : 'profissional'}
- Inclui estatísticas ou factos do artigo quando possível
- Faz referência ao produto de forma natural se aplicável
`;
}

export function buildLinkedInPostPrompt(params: ContentPromptParams): string {
    const context = buildContext(params);

    return `${context}

## Tarefa
Cria um post opinativo para LinkedIn baseado no artigo.

Requisitos:
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

Instruções:
- Escreve em ${context.includes('Idioma: português') ? 'português' : 'inglês'}
- Usa o tom: ${context.includes('Tom de voz:') ? context.match(/Tom de voz: (.+)/)?.[1] || 'profissional e directo' : 'profissional e directo'}
- Faz uma afirmação forte no início
- Usa quebras de linha para melhorar legibilidade
- Inclui história pessoal ou experiência quando relevante
`;
}

export function buildInstagramPostPrompt(params: ContentPromptParams): string {
    const context = buildContext(params);

    return `${context}

## Tarefa
Cria um post curto e visual para Instagram baseado no artigo.

Requisitos:
- 50-150 palavras
- Linguagem casual e acessível
- Include 5-8 hashtags no final
- Formato do output deve ser JSON válido:

\`\`\`json
{
  "title": "Título interno do post",
  "body": "Texto do post...",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6", "#hashtag7", "#hashtag8"]
}
\`\`\`

Instruções:
- Escreve em ${context.includes('Idioma: português') ? 'português' : 'inglês'}
- Tom: casual e conversacional
- Usa emojis estrategicamente
- Foca num único ponto principal
- Considera o que funcionária visualmente como caption
`;
}

export function buildShortVideoPrompt(params: ContentPromptParams): string {
    const context = buildContext(params);

    return `${context}

## Tarefa
Cria um gancho e CTA para um vídeo curto (TikTok/Reels) baseado no artigo.

Requisitos:
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

Instruções:
- Escreve em ${context.includes('Idioma: português') ? 'português' : 'inglês'}
- O hook deve ser surpreendente, provocador ou utilitário
- O CTA deve ser claro e direccionado
- Considera que o hook aparece antes do utilizador decidir se fica a ver
`;
}

export function buildCtaPostPrompt(params: ContentPromptParams): string {
    const context = buildContext(params);

    return `${context}

## Tarefa
Cria um post directo com call-to-action forte para LinkedIn, baseado no artigo.

Requisitos:
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

Instruções:
- Escreve em ${context.includes('Idioma: português') ? 'português' : 'inglês'}
- Tom: ${context.includes('Tom de voz:') ? context.match(/Tom de voz: (.+)/)?.[1] || 'directo e convincente' : 'directo e convincente'}
- Foca nos benefícios, não nas features
- Cria urgência sem ser manipulativo
- O link deve aparecer como placeholder: [LINK]
`;
}

export function buildThreadPrompt(params: ContentPromptParams): string {
    const context = buildContext(params);

    return `${context}

## Tarefa
Cria uma thread (série de posts) para X/Twitter baseada no artigo.

Requisitos:
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

Instruções:
- Escreve em ${context.includes('Idioma: português') ? 'português' : 'inglês'}
- Tom: conversacional mas informativo
- Cada tweet deve funcionar isoladamente mas fazer sentido na sequência
- Usa numeração ou marcadores (1/, 2/, etc.) para clareza
- Último tweet: pergunta para engagement ou link
`;
}

export function buildVideoScriptPrompt(params: ContentPromptParams): string {
    const context = buildContext(params);

    return `${context}

## Tarefa
Cria um roteiro de vídeo curto (30-60 segundos) baseado no artigo.

Requisitos:
- Hook: Primeiros 3 segundos (gancho visual/verbal)
- Introdução: 5 segundos
- Corpo: 30-40 segundos (pontos principais)
- CTA: 5-10 segundos
- Formato do output deve ser JSON válido:

\`\`\`json
{
  "title": "Título do vídeo",
  "hook": "Texto do gancho inicial (aparece no ecrã)",
  "body": "Roteiro do corpo do vídeo...",
  "cta": "Call to action final",
  "durationSec": 60
}
\`\`\`

Instruções:
- Escreve em ${context.includes('Idioma: português') ? 'português' : 'inglês'}
- Linguagem natural para ser dita
- Script deve ser conversacional, não lido
- Inclui indicações de expressão facial ou tom de voz se relevante
`;
}

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

export function parseVideoScriptResponse(text: string): {
    title: string | null;
    hook: string | null;
    body: string | null;
    cta: string | null;
    durationSec: number | null;
} | null {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            title: parsed.title || null,
            hook: parsed.hook || null,
            body: parsed.body || null,
            cta: parsed.cta || null,
            durationSec: parsed.durationSec || 60,
        };
    } catch {
        return null;
    }
}

export function buildPromptForFormat(
    format: ContentFormat,
    params: ContentPromptParams
): string {
    switch (format) {
        case 'CAROUSEL':
            return buildCarouselPrompt(params);
        case 'LINKEDIN_POST':
            return buildLinkedInPostPrompt(params);
        case 'IMAGE':
            return buildInstagramPostPrompt(params);
        case 'SHORT_VIDEO':
            return buildShortVideoPrompt(params);
        case 'CTA_POST':
            return buildCtaPostPrompt(params);
        case 'THREAD':
            return buildThreadPrompt(params);
        case 'VIDEO_SCRIPT':
            return buildVideoScriptPrompt(params);
        default:
            return buildLinkedInPostPrompt(params);
    }
}
