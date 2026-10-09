import {
    CONTENT_FORMAT_DEFAULTS,
    CONTENT_FORMAT_ICONS,
    CONTENT_FORMAT_LABELS,
    type ContentFormat,
    type SocialChannel,
} from '../types/database.js';

/**
 * REGISTO ÚNICO dos tipos de peça.
 *
 * Antes o enum `ContentFormat` estava replicado em ~10 ficheiros
 * (`CONTENT_FORMAT_EMOJIS`, `ALL_FORMATS` ×2, `FORMAT_ICONS` ×2,
 * `PROMPT_WRITER_FORMATS`, o set `CONTENT_FORMATS` do servidor, …), e
 * acrescentar um tipo obrigava a tocar em todos — era assim que os formatos se
 * desalinhavam do resto da app. Aqui ficam os cinco, uma vez.
 *
 * ⚠️ `CONTENT_FORMAT_EMOJIS` continua a ser exportado como alias porque ainda
 * há consumidores a usá-lo; quando desaparecerem, este ficheiro é o sítio certo
 * para limpar.
 */

/** @deprecated Usa `getFormatEmoji()`. Alias do registo único. */
export const CONTENT_FORMAT_EMOJIS: Record<string, string> =
    CONTENT_FORMAT_ICONS;
export const ALL_CONTENT_FORMATS: readonly ContentFormat[] = [
    'POST',
    'CAROUSEL',
    'IMAGE',
    'SHORT_VIDEO',
    'VIDEO',
] as const;

/** Rótulo legível. O nome da plataforma NUNCA entra aqui. */
export function getFormatLabel(format: ContentFormat | string): string {
    return CONTENT_FORMAT_LABELS[format as ContentFormat] ?? 'Peça';
}

export function getFormatEmoji(format: ContentFormat | string): string {
    return CONTENT_FORMAT_ICONS[format as ContentFormat] ?? '📄';
}

/** Canal pré-sugerido para o tipo (só valor inicial do picker). */
export function getFormatDefaultChannel(format: ContentFormat): SocialChannel {
    return CONTENT_FORMAT_DEFAULTS[format];
}

/** O tipo é um texto corrido (sem slides nem cenas)? */
export function isTextOnlyType(format: ContentFormat): boolean {
    return format === 'POST';
}

/** O tipo tem slides, logo dá um artefacto por slide? */
export function hasSlides(format: ContentFormat): boolean {
    return format === 'CAROUSEL';
}

/** O tipo tem cenas, logo dá prompts de vídeo/áudio por cena? */
export function hasScenes(format: ContentFormat): boolean {
    return format === 'VIDEO' || format === 'SHORT_VIDEO';
}

/** Set para validação server-side (o counterpart de `ALL_CONTENT_FORMATS`). */
export const CONTENT_FORMAT_SET: ReadonlySet<string> = new Set<string>(
    ALL_CONTENT_FORMATS
);

/**
 * Chave de um item dentro da peça — a mesma que `content_generation_prompts`
 * e `content_media_prompts` usam. Um único sítio para gerar as chaves, senão
 * `slide-N` e `scene-N` divergem entre o prompt-writer e a geração de media.
 */
export type PieceItemKey = string;

export function slideItemKey(order: number): PieceItemKey {
    return `slide-${order}`;
}

export function sceneItemKey(order: number): PieceItemKey {
    return `scene-${order}`;
}

export function illustrationItemKey(index: number): PieceItemKey {
    return `ilustracao-${index}`;
}

export const MAIN_ITEM_KEY: PieceItemKey = 'main';

/** `slide-3` → 3. `main`/outros → `null`. */
export function itemKeyOrder(key: PieceItemKey | null | undefined): number | null {
    if (!key) return null;
    const match = /^[\w-]*?-(\d+)$/.exec(key);
    return match ? Number(match[1]) : null;
}