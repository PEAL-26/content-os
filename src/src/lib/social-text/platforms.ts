/**
 * Presets de plataforma para texto copiado para redes sociais.
 *
 * Não é só o limite de caracteres. Cada plataforma tem manias próprias de
 * whitespace, de truncagem e de hashtags, e ignorá-las faz o post colado ficar
 * diferente do que se vê no editor.
 */

/** Plataformas suportadas no menu de copiar. */
export type SocialPlatformId = 'LINKEDIN' | 'INSTAGRAM' | 'X' | 'THREADS';

export interface PlatformPreset {
    id: SocialPlatformId;
    label: string;
    /**
     * Limite em **unidades UTF-16**, que é o que as plataformas contam
     * (`String.length` em JS dá exactamente isto).
     *
     * Importante: os caracteres Unicode de negrito/itálico são surrogate pairs e
     * custam 2 cada. Um gancho de 80 caracteres em negrito come 160 dos 220 do
     * headline do LinkedIn.
     */
    charLimit: number;
    /** Onde o "see more" corta, em caracteres visíveis. */
    visibleChars: number;
    /** Máximo de hashtags que a plataforma aceita. */
    hashtagLimit: number;
    /**
     * Se a plataforma apaga linhas completamente vazias. Quando true, cada
     * linha em branco recebe `U+2800` (Braille Pattern Blank) — invisível, mas
     * conta como conteúdo, portanto a linha sobrevive ao paste.
     */
    spacer: boolean;
    /** Linhas em branco entre blocos de texto. */
    blankLines: number;
    /**
     * Linhas em branco entre o corpo e as hashtags. No Instagram a legenda
     * trunca aos 125 caracteres, por isso um gap grande esconde as hashtags
     * abaixo do "more" — que é onde as queres.
     */
    hashtagGap: number;
    /** Prefixar cada tweet com `1/N` (convenção de thread no X). */
    numberTweets: boolean;
}

/**
 * U+2800 BRAILLE PATTERN BLANK.
 *
 * O LinkedIn trata `\n\n` como whitespace redundante e reduz a um único break.
 * Uma linha com U+2800 está "vazia" a olho mas não é vazia para o parser, logo
 * não é colapsada. Custa 1 unidade UTF-16.
 *
 * Só se usa no LinkedIn: nas restantes plataformas é só ruído invisível.
 */
export const BRAILLE_BLANK = '⠀';

export const PLATFORM_PRESETS: Record<SocialPlatformId, PlatformPreset> = {
    LINKEDIN: {
        id: 'LINKEDIN',
        label: 'LinkedIn',
        charLimit: 3000,
        visibleChars: 210,
        hashtagLimit: 30,
        spacer: true,
        blankLines: 1,
        hashtagGap: 1,
        numberTweets: false,
    },
    INSTAGRAM: {
        id: 'INSTAGRAM',
        label: 'Instagram',
        charLimit: 2200,
        visibleChars: 125,
        hashtagLimit: 30,
        // O Instagram remove trailing whitespace em algumas apps; o gap de
        // hashtags é feito com linhas em branco normais.
        spacer: false,
        blankLines: 1,
        hashtagGap: 4,
        numberTweets: false,
    },
    X: {
        id: 'X',
        label: 'X',
        charLimit: 280,
        visibleChars: 280,
        // No X as hashtags contam para o limite e mais de uma é praticamente
        // inútil num post curto — o corte é por omisso.
        hashtagLimit: 1,
        spacer: false,
        blankLines: 1,
        hashtagGap: 1,
        numberTweets: true,
    },
    THREADS: {
        id: 'THREADS',
        label: 'Threads',
        charLimit: 500,
        visibleChars: 500,
        hashtagLimit: 3,
        spacer: false,
        blankLines: 1,
        hashtagGap: 1,
        numberTweets: false,
    },
};

export const PLATFORM_IDS: readonly SocialPlatformId[] = [
    'LINKEDIN',
    'INSTAGRAM',
    'X',
    'THREADS',
];

/**
 * Conta o custo em unidades UTF-16 — o mesmo cálculo que as plataformas fazem.
 *
 * `String.length` já dá unidades UTF-16 (código, não glifo), por isso os
 * caracteres de negrito Unicode custam 2. Não há nada a converter — o objectivo
 * é só nomear a regra, porque é ela que explica porque é que 400 caracteres
 * visíveis são 600 no LinkedIn.
 */
export function countUtf16(text: string): number {
    return text.length;
}

/** Estado do texto face ao limite da plataforma. */
export interface CharCountStatus {
    count: number;
    limit: number;
    /** Percentagem usada, 0–100 (limitado a 100 para o barra de progresso). */
    percent: number;
    /** O texto excede o limite e a plataforma vai recusar ou truncar. */
    exceeds: boolean;
    /** O texto passa do ponto de "see more" e o resto fica escondido. */
    hiddenByFold: boolean;
}

export function measureForPlatform(
    text: string,
    platform: PlatformPreset
): CharCountStatus {
    const count = countUtf16(text);
    return {
        count,
        limit: platform.charLimit,
        percent: Math.min(100, (count / platform.charLimit) * 100),
        exceeds: count > platform.charLimit,
        hiddenByFold: count > platform.visibleChars,
    };
}

/** Normaliza uma hashtag para `#nome`, sem duplicar o `#`. */
export function normaliseHashtag(raw: string): string {
    const trimmed = raw.trim().replace(/^#+/, '');
    return trimmed ? `#${trimmed}` : '';
}
