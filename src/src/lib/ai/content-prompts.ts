import type {
    Article,
    ContentFormat,
    ContentScene,
    ContentSlide,
    Product,
    Workspace,
} from '@/types/database';
import type { PillarConfig } from '@/types/pillar';
import type { PortablePromptItem } from './types.js';

// =============================================================================
// Prompts de conteúdo — system (função + envelope) e user (contexto).
//
// ⚠️ REGRA INVARIANTE: nenhum prompt de sistema de TIPO pode Mentionar uma
// plataforma. O canal entra DEPOIS, no bloco de plataforma
// (`lib/platform-rules/platform-block.ts`), que não é editável. Era aqui que o
// bug nascia: o formato escolhia o template e a plataforma estava hardcoded na
// prosa, pelo que escolher LinkedIn e depois Instagram gerava LinkedIn.
// =============================================================================

export interface ContentPromptParams {
    article: Article;
    workspace: Workspace;
    product?: Product;
    pillar?: PillarConfig;
    /** Duração alvo dos vídeos. Só usado por SHORT_VIDEO / VIDEO. */
    durationSec?: number;
}

/**
 * Params mínimos dos builders de system prompt — só o workspace (idioma/tom).
 * Subconjunto que permite mostrar os defaults no editor de prompts sem um
 * artigo falso.
 */
export interface SystemPromptParams {
    workspace: Workspace;
    durationSec?: number;
}

// -----------------------------------------------------------------------------
// Contexto (user prompt) — partilhado por todos os tipos
// -----------------------------------------------------------------------------

export interface ContextOptions {
    /**
     * Tom do canal. Sobrepõe `workspace.voiceTone` quando preenchido — é o que
     * faz "casual, rápido, directo ao ponto" chegar ao prompt do TikTok.
     */
    toneOverride?: string | null;
}

export function buildContext(
    params: ContentPromptParams,
    options: ContextOptions = {}
): string {
    const { article, workspace, product, pillar } = params;

    const language = languageLabelOf(workspace);
    const voiceTone = options.toneOverride?.trim() || voiceToneOf(workspace);

    let context = `## Contexto\n`;
    context += `Idioma: ${language}\n`;
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
// ENVELOPE ÚNICO
//
// Um só shape para os 5 tipos. `slides` só aparece em CAROUSEL, `scenes` +
// `durationSec` só em SHORT_VIDEO / VIDEO. Assim há um schema Zod só, um
// parser só, e as colunas da BD continuam a ter forma estável.
// -----------------------------------------------------------------------------

export const CONTENT_ENVELOPE_JSON = `\`\`\`json
{
  "title": "Título interno de referência",
  "hookText": "Primeira linha, a que prende atenção (opcional)",
  "body": "O texto que o utilizador vai publicar",
  "ctaText": "Chamada à acção (opcional)",
  "hashtags": ["#exemplo"],
  "slides": [
    {"order": 1, "title": "Título do slide", "body": "Corpo do slide"}
  ],
  "scenes": [
    {
      "order": 1,
      "kind": "hook",
      "narration": "O que se diz",
      "visual": "O que se vê",
      "onScreenText": "Texto no ecrã (opcional)"
    }
  ],
  "durationSec": 60
}
\`\`\``;

/** Blocos do envelope que só existem em CAROUSEL. */
const SLIDES_BLOCK = `- "slides": obrigatório, mínimo 5 e máximo 10 elementos. O primeiro slide é o gancho; o último tem o CTA.`;

/** Blocos do envelope que só existem em SHORT_VIDEO / VIDEO. */
const SCENES_BLOCK = `- "scenes": obrigatório. Uma cena por bloco da estrutura (hook → problema → solução → cta), com "order" sequencial e "kind" de entre hook|problem|solution|cta.
- "visual": descreve o que aparece no ecrã. É daqui que sai o prompt da imagem do vídeo.
- "onScreenText": texto curto que sobrepõe a imagem.
- "body": o roteiro completo, em texto corrido, para ler em voz alta.`;

const COMMON_RULES = (language: string, tone: string): string => `## Instruções
- Escreve em ${language}
- Usa o tom: ${tone}
- Responde APENAS com o JSON pedido. Sem texto antes, sem comentários depois, sem cercas fora do bloco de código.`;

// -----------------------------------------------------------------------------
// System prompts por tipo — SEM plataforma. Os limites (caracteres, hashtags,
// extensão) vivem no bloco de plataforma, editável pelo utilizador.
// -----------------------------------------------------------------------------

export function buildPostSystemPrompt(params: SystemPromptParams): string {
    const language = languageLabelOf(params.workspace);
    const tone = voiceToneOf(params.workspace, 'profissional e directo');

    return `És um copywriter especialista em conteúdo para redes sociais.

## Tarefa
Escreve um post de rede social a partir do artigo fornecido. O texto vai ser publicado
tal e qual, por isso tem de funcionar sozinho, sem contexto exterior.

## Requisitos
- "body" é o texto de publicação: continua, com gancho na primeira linha.
- "hookText" repete a primeira linha, para a UI poder mostrar o gancho isolado.
- "ctaText" só quando o conteúdo justificar um pedido ao leitor.
- "hashtags": array de strings. A quantidade e se devem ser usados decide o bloco de plataforma.

## Formato do output
${CONTENT_ENVELOPE_JSON}

${COMMON_RULES(language, tone)}
- Faz uma afirmação forte logo na primeira linha.
- Usa quebras de linha em branco para melhorar a leitura em ecrã pequeno.
- Inclui história, exemplo ou experiência quando o artigo os tiver.`;
}

export function buildCarouselSystemPrompt(params: SystemPromptParams): string {
    const language = languageLabelOf(params.workspace);
    const tone = voiceToneOf(params.workspace, 'profissional');

    return `És um especialista em sequências de slides para redes sociais.

## Tarefa
Escreve um carrossel de slides a partir do artigo fornecido.

## Requisitos
${SLIDES_BLOCK}
- "body": a junção de todos os slides, cada um como "## Título\\nCorpo", separados por linha em branco.
- Se o canal onde isto vai ser publicado não tiver carrossel nativo, o bloco de plataforma diz-te como adaptar. Obedece a essa instrução e não a esta estrutura de slides se ela entrar em conflito.

## Formato do output
${CONTENT_ENVELOPE_JSON}

${COMMON_RULES(language, tone)}
- Cada slide cabe num ecrã: título curto, corpo conciso.
- Usa estatísticas ou factos concretos do artigo.`;
}

export function buildImageSystemPrompt(params: SystemPromptParams): string {
    const language = languageLabelOf(params.workspace);
    const tone = voiceToneOf(params.workspace, 'acessível');

    return `És um especialista em conteúdo visual para redes sociais.

## Tarefa
Escreve a legenda que acompanha uma imagem, a partir do artigo fornecido.

## Requisitos
- "body" é a legenda. Curta, com ritmo, e legível sem o contexto do artigo.
- A imagem em si não a inventas: mais adiante um passo separado escreve o prompt visual. Aqui só entregas o texto.

## Formato do output
${CONTENT_ENVELOPE_JSON}

${COMMON_RULES(language, tone)}
- Foca num único ponto principal.
- Usa emojis com moderação e apenas onde ajudam.`;
}

export function buildShortVideoSystemPrompt(params: SystemPromptParams): string {
    const durationSec = params.durationSec || 30;
    const language = languageLabelOf(params.workspace);
    const tone = voiceToneOf(params.workspace, 'casual e directo');

    return `És um especialista em vídeos curtos para redes sociais.

## Tarefa
Escreve o roteiro de um vídeo curto (cerca de ${durationSec} segundos) a partir do artigo.

## Estrutura
1. **Hook (3-5s)**: frase que faz o espectador ficar. Pergunta provocadora, dado surpreendente ou afirmação controversa.
2. **Problema (5-10s)**: a dor que o artigo endereça.
3. **Solução (restante)**: os pontos principais, conversacional.
4. **CTA (5-10s)**: pedido claro.

## Requisitos
${SCENES_BLOCK}
- "durationSec": ${durationSec}

## Formato do output
${CONTENT_ENVELOPE_JSON}

${COMMON_RULES(language, tone)}
- Escreve para ser ouvido, não lido: frases curtas.
- "onScreenText" complementa o que se diz; nunca repete.`;
}

export function buildVideoSystemPrompt(params: SystemPromptParams): string {
    const durationSec = params.durationSec || 300;
    const language = languageLabelOf(params.workspace);
    const tone = voiceToneOf(params.workspace, 'elaborado e didático');

    return `És um especialista em vídeos longos para redes sociais.

## Tarefa
Escreve o roteiro de um vídeo longo (cerca de ${durationSec} segundos) a partir do artigo.

## Estrutura
1. **Hook**: o que impede o espectador de sair nos primeiros segundos.
2. **Problema**: o problema, com exemplos concretos.
3. **Solução**: desenvolvimento dos pontos principais do artigo, com contexto.
4. **CTA**: pedido claro.

## Requisitos
${SCENES_BLOCK}
- "durationSec": ${durationSec}

## Formato do output
${CONTENT_ENVELOPE_JSON}

${COMMON_RULES(language, tone)}
- Pode ser mais desenvolvido que o vídeo curto: contexto e exemplos são bem-vindos.`;
}

// -----------------------------------------------------------------------------
// Resolução do system prompt padrão de um tipo (default em código)
// -----------------------------------------------------------------------------

export const CONTENT_TYPE_LABELS: Record<string, string> = {
    article: 'Artigo',
    // Metadados de um artigo existente (job ARTICLE_METADATA). Não é um
    // ContentFormat — `default-system-prompts.ts` tem de o tratar ANTES do
    // fallthrough para `buildSystemPromptForType`.
    article_metadata: 'Metadados do artigo',
    POST: 'Post',
    CAROUSEL: 'Carrossel',
    IMAGE: 'Image',
    SHORT_VIDEO: 'Short Video',
    VIDEO: 'Vídeo',
};

export function buildSystemPromptForType(
    type: ContentFormat,
    params: SystemPromptParams
): string {
    switch (type) {
        case 'POST':
            return buildPostSystemPrompt(params);
        case 'CAROUSEL':
            return buildCarouselSystemPrompt(params);
        case 'IMAGE':
            return buildImageSystemPrompt(params);
        case 'SHORT_VIDEO':
            return buildShortVideoSystemPrompt(params);
        case 'VIDEO':
            return buildVideoSystemPrompt(params);
        default:
            return buildPostSystemPrompt(params);
    }
}

export function buildPromptForType(
    type: ContentFormat,
    params: ContentPromptParams,
    options: ContextOptions = {}
): string {
    return `${buildSystemPromptForType(type, params)}\n\n${buildContext(params, options)}`;
}

// -----------------------------------------------------------------------------
// Prompts portáteis (finais, self-contained) por item — guardados em
// content_generation_prompts. Recriam exactamente o item gerado.
// -----------------------------------------------------------------------------

function buildPortablePrompt(
    params: ContentPromptParams,
    systemPrompt: string,
    itemKey: string,
    itemTitle: string | null,
    itemText: string,
    options: ContextOptions = {}
): string {
    const label = itemTitle ? `${itemKey} — ${itemTitle}` : itemKey;

    return `${systemPrompt}

${buildContext(params, options)}

## Item específico a gerar (${label.replace(/\|/g, '')})
${itemText.trim()}

Este é um item de uma peça maior. Gera apenas este item, com o formato e tom
descritos acima, sem incluir nenhum outro item.
`;
}

/** Prompt portátil de um slide de carrossel. */
export function buildSlideItemPortablePrompt(
    params: ContentPromptParams,
    slide: ContentSlide,
    index: number,
    systemOverride?: string,
    options: ContextOptions = {}
): string {
    const body = slide.body || '';
    const title = `Slide ${slide.order ?? index + 1} (carrossel)`;
    return buildPortablePrompt(
        params,
        systemOverride ?? buildCarouselSystemPrompt(params),
        `slide-${slide.order ?? index + 1}`,
        title,
        slide.title ? `Título: ${slide.title}\n\n${body}` : body,
        options
    );
}

/** Prompt portátil de uma cena de vídeo. */
export function buildSceneItemPortablePrompt(
    params: ContentPromptParams,
    scene: ContentScene,
    systemOverride?: string,
    options: ContextOptions = {}
): string {
    const parts = [
        `Narração: ${scene.narration}`,
        scene.visual ? `Visual: ${scene.visual}` : '',
        scene.onScreenText ? `Texto no ecrã: ${scene.onScreenText}` : '',
    ].filter(Boolean);

    return buildPortablePrompt(
        params,
        systemOverride ?? buildVideoSystemPrompt(params),
        `scene-${scene.order}`,
        `Cena ${scene.order} (${scene.kind})`,
        parts.join('\n'),
        options
    );
}

/** Prompt portátil de uma peça de item único. */
export function buildSingleItemPortablePrompt(
    type: ContentFormat,
    params: ContentPromptParams,
    title: string | null,
    body: string,
    systemOverride?: string,
    options: ContextOptions = {}
): string {
    return buildPortablePrompt(
        params,
        systemOverride ?? buildSystemPromptForType(type, params),
        'main',
        title,
        body,
        options
    );
}

// -----------------------------------------------------------------------------
// Parse de um ÚNICO item (regeneração parcial: "Gerar este slide")
// -----------------------------------------------------------------------------

export interface ParsedSingleItem {
    title: string | null;
    body: string;
}

export function parseSingleItemResponse(text: string): ParsedSingleItem | null {
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);

            // a) Carrossel: { title, slides: [...] } → primeiro slide.
            if (Array.isArray(parsed.slides) && parsed.slides.length > 0) {
                const slide = parsed.slides[0];
                const body = String(slide?.body ?? '').trim();
                if (body) {
                    return {
                        title: slide?.title
                            ? String(slide.title).trim()
                            : (parsed.title ? String(parsed.title).trim() : null),
                        body,
                    };
                }
            }

            // b) Vídeo: { scenes: [...] } → primeira cena.
            if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
                const scene = parsed.scenes[0];
                const body = String(scene?.narration ?? '').trim();
                if (body) return { title: null, body };
            }

            // c) JSON simples: { title, body }.
            const body = String(parsed.body ?? parsed.text ?? '').trim();
            if (body) {
                return {
                    title: parsed.title ? String(parsed.title).trim() : null,
                    body,
                };
            }
        } catch {
            // JSON inválido — cai para texto simples.
        }
    }

    const plain = stripMarkdownTitle(text.trim());
    if (plain.length > 0) {
        return { title: null, body: plain };
    }

    return null;
}

/** Separa "## Título\n\nCorpo" num par { title, body }. */
function stripMarkdownTitle(text: string): string {
    const match = text.match(/^#{1,3}\s+(.+?)\n+([\s\S]+)$/);
    if (!match) return text;
    return `${match[1].trim()}\n\n${match[2].trim()}`;
}

/**
 * Aplica o item regenerado à peça: actualiza só o slide (ou cena) indicado,
 * mantendo os restantes intactos. Devolve os campos a persistir.
 */
export function applySingleItemToPiece(
    type: ContentFormat,
    piece: { body: string; slides: ContentSlide[] | null; scenes?: ContentScene[] | null },
    itemKey: string,
    item: ParsedSingleItem
): {
    body: string;
    slides: ContentSlide[] | null;
    scenes: ContentScene[] | null;
    slideCount: number | null;
} {
    const orderMatch = /^(?:slide|scene|tweet)-(\d+)$/.exec(itemKey);
    const order = orderMatch ? Number(orderMatch[1]) : null;
    const unchanged = {
        ...piece,
        scenes: piece.scenes ?? null,
        slideCount: piece.slides?.length ?? null,
    };

    if (type === 'CAROUSEL' && order !== null) {
        const slides = piece.slides ?? [];
        if (slides.length === 0) return unchanged;

        const index = slides.findIndex(
            (s, i) => (s.order ?? 0) === order || i === order - 1
        );
        if (index === -1) return unchanged;

        const next = slides.map((slide, i) =>
            i === index
                ? { order: slide.order, title: item.title ?? slide.title, body: item.body }
                : slide
        );

        return {
            slides: next,
            body: next.map((s) => `## ${s.title}\n${s.body}`).join('\n\n'),
            scenes: null,
            slideCount: next.length,
        };
    }

    if ((type === 'VIDEO' || type === 'SHORT_VIDEO') && order !== null) {
        const scenes = piece.scenes ?? [];
        if (scenes.length === 0) return unchanged;

        const index = scenes.findIndex((s, i) => (s.order ?? 0) === order || i === order - 1);
        if (index === -1) return unchanged;

        const next = scenes.map((scene, i) =>
            i === index
                ? { ...scene, narration: item.body, visual: null, onScreenText: null }
                : scene
        );

        return {
            slides: null,
            scenes: next,
            body: next.map((s) => s.narration).join('\n\n'),
            slideCount: null,
        };
    }

    return unchanged;
}

/** Prompt portátil do item regenerado (reconstruído a partir do novo texto). */
export function buildItemPortablePrompt(
    type: ContentFormat,
    params: ContentPromptParams,
    itemKey: string,
    itemText: string,
    systemOverride?: string,
    options: ContextOptions = {}
): string {
    const order = /-(\d+)$/.exec(itemKey)?.[1];
    const n = order ? Number(order) : 1;

    if (type === 'CAROUSEL') {
        return buildSlideItemPortablePrompt(
            params,
            { order: n, title: '', body: itemText },
            n - 1,
            systemOverride,
            options
        );
    }

    if (type === 'VIDEO' || type === 'SHORT_VIDEO') {
        return buildSceneItemPortablePrompt(
            params,
            { order: n, kind: 'solution', narration: itemText },
            systemOverride,
            options
        );
    }

    return buildSingleItemPortablePrompt(
        type,
        params,
        null,
        itemText,
        systemOverride,
        options
    );
}

// -----------------------------------------------------------------------------
// Parse do envelope → shape persistível de uma peça
// Puro, partilhado client/server. Um parser para os 5 tipos: o que distingue um
// tipo do outro é quais os blocos opcionais que vêm preenchidos.
// -----------------------------------------------------------------------------

export interface ParsedGeneratedPiece {
    format: ContentFormat;
    title: string | null;
    body: string;
    hookText: string | null;
    ctaText: string | null;
    hashtags: string[];
    slides: ContentSlide[] | null;
    slideCount: number | null;
    scenes: ContentScene[] | null;
    durationSec: number | null;
}

/** Extrai `json`, tolerando cercas ```json e lixo à volta. */
function extractJson(text: string): unknown | null {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

function toHashtags(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((tag) => String(tag).trim()).filter(Boolean);
}

export function parseGeneratedContent(
    format: ContentFormat,
    text: string
): ParsedGeneratedPiece | null {
    const parsed = extractJson(text);
    if (!parsed || typeof parsed !== 'object') return null;
    const raw = parsed as Record<string, unknown>;

    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : null;
    const rawBody = typeof raw.body === 'string' ? raw.body.trim() : '';

    const slides = Array.isArray(raw.slides)
        ? raw.slides.map((s, i) => {
              const slide = (s ?? {}) as Record<string, unknown>;
              return {
                  order: typeof slide.order === 'number' ? slide.order : i + 1,
                  title: typeof slide.title === 'string' ? slide.title : '',
                  body: typeof slide.body === 'string' ? slide.body : '',
              };
          })
        : null;

    const scenes = Array.isArray(raw.scenes)
        ? raw.scenes.map((s, i) => {
              const scene = (s ?? {}) as Record<string, unknown>;
              return {
                  order: typeof scene.order === 'number' ? scene.order : i + 1,
                  kind: typeof scene.kind === 'string' ? scene.kind : 'solution',
                  narration: typeof scene.narration === 'string' ? scene.narration : '',
                  visual: typeof scene.visual === 'string' ? scene.visual : null,
                  onScreenText:
                      typeof scene.onScreenText === 'string' ? scene.onScreenText : null,
              };
          })
        : null;

    const hashtags = toHashtags(raw.hashtags);
    const durationSec =
        typeof raw.durationSec === 'number' && raw.durationSec > 0 ? raw.durationSec : null;

    // O corpo pode vir pronto, ou ter de ser montado a partir dos blocos.
    const body =
        rawBody ||
        (slides
            ? slides.map((s) => `## ${s.title}\n${s.body}`).join('\n\n')
            : scenes
              ? scenes.map((s) => s.narration).join('\n\n')
              : '');

    if (!body && (!slides || slides.length === 0) && (!scenes || scenes.length === 0)) {
        return null;
    }

    return {
        format,
        title,
        body,
        hookText: pickString(raw.hookText) ?? firstNonEmptyLine(body),
        ctaText: pickString(raw.ctaText) ?? lastItemBody(slides, scenes),
        hashtags,
        slides,
        slideCount: slides ? slides.length : null,
        scenes,
        durationSec,
    };
}

function pickString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstNonEmptyLine(body: string): string | null {
    return body.split('\n').find((line) => line.trim())?.trim() ?? null;
}

function lastItemBody(
    slides: ContentSlide[] | null,
    scenes: ContentScene[] | null
): string | null {
    if (slides && slides.length > 0) {
        return pickString(slides[slides.length - 1]?.body);
    }
    if (scenes && scenes.length > 0) {
        return pickString(scenes[scenes.length - 1]?.narration);
    }
    return null;
}

/**
 * Prompts finais portáteis de uma peça gerada — por item (slide, cena) ou
 * item único, para registo em content_generation_prompts. Puro (partilhado).
 */
export interface PortablePromptsForPieceParams {
    article: Article;
    workspace: Workspace;
    product?: Product;
    pillar?: PillarConfig;
}

export function buildPortablePromptsForPiece(
    type: ContentFormat,
    params: PortablePromptsForPieceParams,
    piece: ParsedGeneratedPiece,
    systemOverride?: string,
    options: ContextOptions = {}
): PortablePromptItem[] {
    if (type === 'CAROUSEL' && piece.slides) {
        return piece.slides.map((slide) => ({
            itemKey: `slide-${slide.order}`,
            prompt: buildSlideItemPortablePrompt(
                params,
                slide,
                slide.order - 1,
                systemOverride,
                options
            ),
        }));
    }

    if ((type === 'VIDEO' || type === 'SHORT_VIDEO') && piece.scenes) {
        return piece.scenes.map((scene) => ({
            itemKey: `scene-${scene.order}`,
            prompt: buildSceneItemPortablePrompt(
                params,
                scene,
                systemOverride,
                options
            ),
        }));
    }

    return [
        {
            itemKey: 'main',
            prompt: buildSingleItemPortablePrompt(
                type,
                params,
                piece.title,
                piece.body,
                systemOverride,
                options
            ),
        },
    ];
}