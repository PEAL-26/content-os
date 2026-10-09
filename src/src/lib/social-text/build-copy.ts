/**
 * Constrói o texto a copiar a partir de uma peça ou roteiro.
 *
 * Separa em duas fases de propósito:
 *
 *   peça → blocos → (renderPlain | renderHtml)
 *
 * Os blocos são o modelo intermédio. É o que permite gerar as duas variantes do
 * clipboard a partir da mesma fonte — `text/plain` com caracteres Unicode (para
 * LinkedIn/IG/X) e `text/html` com `<strong>`/`<ul>` reais (para Notion, Google
 * Docs, Gmail) — sem duplicar a lógica de parsing.
 *
 * A estrutura vem dos campos que o schema **já tem** (hook, título de slide,
 * CTA), não de heurísticas inventadas: o corpo de uma peça LinkedIn é texto
 * simples e não tem nada a converter.
 */


import type { ContentPieceWithRelations } from '@/types/database';

import {
    BRAILLE_BLANK,
    normaliseHashtag,
    type PlatformPreset,
} from './platforms';
import { applyStyle, type UnicodeStyleId } from './unicode-styles';

// ---------------------------------------------------------------------------
// Modelo intermédio
// ---------------------------------------------------------------------------

export type Emphasis = 'none' | 'bold' | 'italic';

/** Trecho de texto com ênfase uniforme. */
export interface Span {
    text: string;
    emphasis: Emphasis;
}

export type CopyBlock =
    | { kind: 'heading'; spans: Span[] }
    | {
          kind: 'paragraph';
          spans: Span[];
          /** Preenchido em threads: { i: 1, total: 5 } → prefixo "1/5". */
          ordinal?: { i: number; total: number };
      }
    | { kind: 'list'; items: Span[][]; ordered: boolean }
    | { kind: 'hashtags'; items: string[] };

/** Fontes que o conversor sabe montar. */
export type CopySource = { type: 'piece'; piece: ContentPieceWithRelations };

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Um texto simples para uma lista de spans sem Processar markdown. */
function plainSpans(text: string): Span[] {
    return [{ text, emphasis: 'none' }];
}

/** Linhas vazias e separadores de markdown não são conteúdo. */
function isBlank(line: string): boolean {
    return !line.trim() || /^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line);
}

/** Remove a marcação markdown de uma linha e devolve o seu conteúdo. */
function stripInlineMarkers(text: string): string {
    return text
        .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim();
}

/**
 * Separa texto markdown em spans com ênfase.
 *
 * Reconhece `**negrito**`, `***negrito itálico***`, `*itálico*` e `` `código` ``.
 * O corpo de uma peça LinkedIn é texto simples e passa por aqui sem alterações;
 * o body de um carrossel é markdown a sério (`## Título` por slide, gravado em
 * `content-prompts.ts:598`) e é aproveitado.
 */
function parseInline(text: string): Span[] {
    const spans: Span[] = [];
    // Padrão único, alternância trapalhada de propósito para que os três
    // marcadores mais fortes venham primeiro e não sejam matchados como `*`.
    const pattern =
        /(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)/g;

    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > cursor) {
            const chunk = text.slice(cursor, match.index);
            if (chunk) spans.push({ text: chunk, emphasis: 'none' });
        }

        // Os grupos ímpares são o match completo (com os marcadores); os pares
        // seguintes são o conteúdo. Errar aqui deixava os asteriscos literais
        // dentro do texto em negrito.
        if (match[2] !== undefined) {
            // `***negrito itálico***` —styled as negrito, que é o mais próximo
            // que os blocos Unicode dão.
            spans.push({ text: match[2], emphasis: 'bold' });
        } else if (match[4] !== undefined) {
            spans.push({ text: match[4], emphasis: 'bold' });
        } else if (match[6] !== undefined) {
            spans.push({ text: match[6], emphasis: 'italic' });
        } else if (match[8] !== undefined) {
            spans.push({ text: match[8], emphasis: 'none' });
        }

        cursor = match.index + match[0].length;
    }

    if (cursor < text.length) {
        const tail = text.slice(cursor);
        if (tail) spans.push({ text: tail, emphasis: 'none' });
    }

    return spans.filter((s) => s.text.length > 0);
}

/** `## Título` → 'Título'. Devolve null se não for um heading markdown. */
function headingOf(line: string): string | null {
    const match = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    return match ? stripInlineMarkers(match[2]) : null;
}

/** `- item` / `* item` → 'item'. Devolve null se não for bullet. */
function bulletOf(line: string): string | null {
    const match = /^\s*[-*+]\s+(.*)$/.exec(line.trim());
    return match ? stripInlineMarkers(match[1]) : null;
}

/**
 * `1. item` → 'item'. Devolve null se não for item numerado.
 *
 * O corte em 99 dígitos é para não engolir uma frase que comece por um número:
 * "2024 foi o ano em que" não é uma lista numerada.
 */
function orderedOf(line: string): string | null {
    const match = /^\s*(\d{1,2})[.)]\s+(.*)$/.exec(line.trim());
    return match ? stripInlineMarkers(match[2]) : null;
}

/**
 * Converte texto simples/markdown numa lista de blocos.
 *
 * Listas contíguas juntam-se num bloco só; headings e parágrafos isolados viram
 * blocos próprios. Uma linha `---` é separador e some.
 */
function parseBody(text: string, withOrdinals = false): CopyBlock[] {
    const blocks: CopyBlock[] = [];
    const lines = (text ?? '').split('\n');

    let buffer: string[] = [];

    const flushParagraph = () => {
        const joined = buffer.join('\n').trim();
        buffer = [];
        if (!joined) return;
        blocks.push({ kind: 'paragraph', spans: parseInline(joined) });
    };

    let bullets: string[] = [];
    let ordered: boolean | null = null;

    const flushList = () => {
        if (bullets.length === 0) return;
        blocks.push({
            kind: 'list',
            items: bullets.map((b) => parseInline(b)),
            ordered: ordered ?? false,
        });
        bullets = [];
        ordered = null;
    };

    for (const line of lines) {
        if (isBlank(line)) {
            // Uma linha em branco fecha a lista e o parágrafo em curso.
            flushList();
            flushParagraph();
            continue;
        }

        const heading = headingOf(line);
        if (heading) {
            flushList();
            flushParagraph();
            blocks.push({ kind: 'heading', spans: parseInline(heading) });
            continue;
        }

        const bullet = bulletOf(line);
        if (bullet !== null) {
            flushParagraph();
            // Só fecha a lista anterior se for de outro tipo; itens da mesma
            // lista têm de juntar-se, senão a numeração reinicia a cada linha.
            if (ordered === true) flushList();
            ordered = false;
            bullets.push(bullet);
            continue;
        }

        const orderedItem = orderedOf(line);
        if (orderedItem !== null) {
            flushParagraph();
            if (ordered === false) flushList();
            ordered = true;
            bullets.push(orderedItem);
            continue;
        }

        flushList();
        buffer.push(line);
    }

    flushList();
    flushParagraph();

    // Thread: atribui `1/N` a cada parágrafo, se o caller pediu. Feito no fim
    // para o total reflectir o número real de blocos.
    if (withOrdinals) {
        const total = blocks.filter((b) => b.kind === 'paragraph').length;
        let index = 0;
        for (let i = 0; i < blocks.length; i += 1) {
            const block = blocks[i];
            if (block.kind === 'paragraph') {
                index += 1;
                blocks[i] = {
                    ...block,
                    ordinal: { i: index, total },
                };
            }
        }
    }

    return blocks;
}

/** Bloco de heading a partir de um campo curto (hook, CTA, título). */
function headingBlock(text: string | null | undefined): CopyBlock[] {
    const trimmed = (text ?? '').trim();
    return trimmed ? [{ kind: 'heading', spans: plainSpans(trimmed) }] : [];
}

/** Junta as hashtags no fim dos blocos, se a peça as tiver. */
function withHashtags(
    blocks: CopyBlock[],
    hashtags: string[] | null | undefined,
    platform?: PlatformPreset
): CopyBlock[] {
    return [...blocks, ...hashtagBlock(hashtags, platform)];
}

// ---------------------------------------------------------------------------
// Peça → blocos
// ---------------------------------------------------------------------------

/** Blocos de hashtags, respeitando o limite da plataforma. */
function hashtagBlock(
    hashtags: string[] | null | undefined,
    platform?: PlatformPreset
): CopyBlock[] {
    const seen = new Set<string>();
    const items: string[] = [];

    for (const raw of hashtags ?? []) {
        const tag = normaliseHashtag(raw);
        if (!tag) continue;
        const key = tag.toLowerCase();
        // O array pode vir com a mesma hashtag repetida; o LinkedIn conta
        // hashtags repetidas para o limite, por isso deduplicar também poupa
        // limite.
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(tag);
    }

    if (items.length === 0) return [];

    return [
        {
            kind: 'hashtags',
            items: platform ? items.slice(0, platform.hashtagLimit) : items,
        },
    ];
}

/**
 * Converte uma peça de conteúdo ou um roteiro em blocos.
 *
 * O mapeamento por formato usa os campos estruturados que o schema já tem:
 *
 * | Tipo           | Blocos                                        |
 * |----------------|-----------------------------------------------|
 * | `CAROUSEL`     | heading (título do slide) + paragraph (corpo) |
 * | `POST`         | paragraph (sequência numerada se for thread)  |
 * | `IMAGE`        | body + hashtags                               |
 * | `SHORT_VIDEO`  | heading (hook) + body + heading (CTA)         |
 * | `VIDEO`        | heading (hook) + body + heading (CTA)         |
 *
 * `title` é de propósito ignorado: o schema documenta-o como "Título
 * interno/referência" e não é para publicar.
 */
export function buildBlocks(
    source: CopySource,
    platform?: PlatformPreset
): CopyBlock[] {
    const { piece } = source;
    const blocks: CopyBlock[] = [];

    switch (piece.format) {
        case 'CAROUSEL': {
            // Os slides vêm estruturados no JSON — usar o array é mais fiável
            // do que re-parsear o markdown do body.
            const slides = piece.slides ?? [];
            if (slides.length > 0) {
                for (const slide of slides) {
                    blocks.push(...headingBlock(slide.title));
                    blocks.push(...parseBody(slide.body ?? ''));
                }
            } else {
                blocks.push(...parseBody(piece.body ?? ''));
            }
            break;
        }

        case 'POST':
            // Um POST num canal COM threads é uma sequência numerada; nos outros
            // é texto corrido. `withOrdinals` só produz "1/5" se o preset pedir.
            blocks.push(...headingBlock(piece.hookText));
            blocks.push(
                ...parseBody(piece.body ?? '', /* withOrdinals */ true)
            );
            blocks.push(...headingBlock(piece.ctaText));
            break;

        case 'IMAGE':
            blocks.push(...headingBlock(piece.hookText));
            blocks.push(...parseBody(piece.body ?? ''));
            blocks.push(...headingBlock(piece.ctaText));
            break;

        case 'SHORT_VIDEO':
        case 'VIDEO':
            blocks.push(...headingBlock(piece.hookText));
            blocks.push(...parseBody(piece.body ?? ''));
            blocks.push(...headingBlock(piece.ctaText));
            break;

        default:
            blocks.push(...parseBody(piece.body ?? ''));
            break;
    }

    return withHashtags(blocks, piece.hashtags, platform);
}

// ---------------------------------------------------------------------------
// Render: texto simples
// ---------------------------------------------------------------------------

/** Aplica o estilo Unicode aos spans marcados. */
function styleSpans(spans: Span[], style: UnicodeStyleId): string {
    return spans
        .map((span) =>
            span.emphasis === 'none' ? span.text : applyStyle(span.text, style)
        )
        .join('');
}

/**
 * Renderiza os blocos em texto simples para uma plataforma.
 *
 * O texto sai **sem** marcadores markdown: `- item` vira `• item`, `## Título`
 * vira uma linha em negrito Unicode. É isto que as redes sociais conseguem
 * mostrar — elas não renderizam markdown.
 */
export function renderPlain(
    blocks: CopyBlock[],
    options: { style: UnicodeStyleId; platform: PlatformPreset }
): string {
    const { style, platform } = options;
    const chunks: string[] = [];

    for (const block of blocks) {
        switch (block.kind) {
            case 'heading': {
                // Um heading é uma linha inteira em negrito.
                const text = block.spans
                    .map((s) => s.text)
                    .join('')
                    .trim();
                if (text) chunks.push(applyStyle(text, style));
                break;
            }

            case 'paragraph': {
                const text = styleSpans(block.spans, style);
                if (!text.trim()) break;
                // Threads no X levam prefixo "1/N".
                const prefix =
                    platform.numberTweets && block.ordinal
                        ? `${block.ordinal.i}/${block.ordinal.total} `
                        : '';
                chunks.push(prefix + text);
                break;
            }

            case 'list': {
                block.items.forEach((item, i) => {
                    const marker = block.ordered ? `${i + 1}.` : '•';
                    chunks.push(`${marker} ${styleSpans(item, style)}`);
                });
                break;
            }

            case 'hashtags':
                chunks.push(block.items.join(' '));
                break;
        }
    }

    // Hashtags entram no fim, com o gap que a plataforma precisa (no Instagram
    // o gap grande é o que as esconde abaixo do "more").
    const body = chunks.filter((c) => c && !c.startsWith('#'));
    const tagLines = chunks.filter((c) => c && c.startsWith('#'));
    if (body.length === 0 && tagLines.length === 0) return '';

    const separator = platform.spacer
        ? `\n\n${BRAILLE_BLANK}\n\n`
        : '\n'.repeat(platform.blankLines + 1);

    let out = body.join(separator);
    if (tagLines.length > 0) {
        // `hashtagGap` conta as linhas em branco entre o corpo e as hashtags. No
        // Instagram são 4, para as hashtags caírem abaixo do "more" (que trunca
        // aos 125 caracteres).
        const tagGap = platform.spacer
            ? `\n${BRAILLE_BLANK}\n\n`
            : '\n'.repeat(platform.hashtagGap + 1);
        out += tagGap + tagLines.join(' ');
    }

    return out.trim();
}

// ---------------------------------------------------------------------------
// Render: HTML
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Escapa e converte spans em HTML, marcando a ênfase com tags reais. */
function renderSpansHtml(spans: Span[]): string {
    return spans
        .map((span) => {
            const escaped = escapeHtml(span.text);
            if (span.emphasis === 'bold') return `<strong>${escaped}</strong>`;
            if (span.emphasis === 'italic') return `<em>${escaped}</em>`;
            return escaped;
        })
        .join('');
}

/**
 * Renderiza os blocos em HTML.
 *
 * É este o que vai para `text/html` no clipboard: o Notion, Google Docs, Gmail e
 * Word leem este flavor e mostram negrito e listas a sério. O mesmo paste num
 * campo de texto simples ignora este flavor e usa o `text/plain`.
 */
export function renderHtml(blocks: CopyBlock[]): string {
    const parts: string[] = [];

    for (const block of blocks) {
        switch (block.kind) {
            case 'heading':
                parts.push(`<h2>${renderSpansHtml(block.spans)}</h2>`);
                break;

            case 'paragraph':
                parts.push(`<p>${renderSpansHtml(block.spans)}</p>`);
                break;

            case 'list': {
                const tag = block.ordered ? 'ol' : 'ul';
                const items = block.items
                    .map((item) => `<li>${renderSpansHtml(item)}</li>`)
                    .join('');
                parts.push(`<${tag}>${items}</${tag}>`);
                break;
            }

            case 'hashtags':
                parts.push(`<p>${escapeHtml(block.items.join(' '))}</p>`);
                break;
        }
    }

    return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Entrada de alto nível
// ---------------------------------------------------------------------------

export interface BuiltCopy {
    /** Variante texto simples (Unicode). Vai sempre para o clipboard. */
    text: string;
    /** Variante HTML rico, para destinos que a saibam ler. */
    html: string;
}

/** Monta as duas variantes de uma só vez. */
export function buildCopy(
    source: CopySource,
    options: { style: UnicodeStyleId; platform: PlatformPreset }
): BuiltCopy {
    const blocks = buildBlocks(source, options.platform);
    return {
        text: renderPlain(blocks, options),
        html: renderHtml(blocks),
    };
}

/**
 * Texto tal como é hoje: campos cronológicos, sem conversão nenhuma.
 *
 * Serve de saída de emergência — sempre que a conversão possa estragar alguma
 * coisa (pesquisa do LinkedIn não indexa Unicode, leitores de ecrã), há uma
 * opção que copia o texto intacto.
 */
export function buildPlainCopy(source: CopySource): string {
    const { piece } = source;
    // Hook primeiro: é a frase que abre o post. A ordem antiga (body, hook,
    // cta) punha o gancho a meio do texto, que é o contrário do que um gancho
    // deve fazer.
    const parts = [piece.hookText, piece.body, piece.ctaText]
        // O `.filter` já garante string não vazia, mas o TypeScript não faz
        // essa ligação; o `?? ''` mantém o tipo sem `any`.
        .map((part) => part?.trim() ?? '')
        .filter((part) => part.length > 0);

    const tags = (piece.hashtags ?? []).map(normaliseHashtag).filter(Boolean);
    if (tags.length > 0) parts.push(tags.join(' '));

    return parts.join('\n\n');
}

export { parseBody, parseInline };
