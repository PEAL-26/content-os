/**
 * Presets de plataforma para texto copiado para redes sociais.
 *
 * Não é só o limite de caracteres. Cada plataforma tem manias próprias de
 * whitespace, de truncagem e de hashtags, e ignorá-las faz o post colado ficar
 * diferente do que se vê no editor.
 *
 * A taxonomia deixou de ser um tipo próprio que vivia aqui (`SocialPlatformId`,
 * com 'X' enquanto o enum da BD dizia 'TWITTER') e passou a ser `SocialChannel`
 * — o enum da BD, sem taxonomia paralela. Os limites vêm de `platform-rules`,
 * com overrides do canal, para que a peça e o medidor nunca discordem.
 */

import {
    aspectRatioFor,
    resolveRules,
    type ResolvedChannelRules,
} from '@/lib/platform-rules';
import { CHANNEL_LABELS, type SocialChannel } from '@/types/database';

/**
 * Os 10 canais — o menu de copiar cobre a taxonomia toda (Decisão 14).
 *
 * Todos têm preset (vêm de `platform-rules`), portanto não há por que excluir
 * TikTok ou YouTube: colar texto formatado para a descrição de um vídeo é
 * precisamente o caso de uso do planeador.
 */
export const COPY_CHANNELS: readonly SocialChannel[] = [
    'LINKEDIN',
    'INSTAGRAM',
    'TIKTOK',
    'YOUTUBE',
    'TWITTER',
    'FACEBOOK',
    'THREADS',
    'PINTEREST',
    'TELEGRAM',
    'WHATSAPP',
];

/**
 * @deprecated O enum `SocialChannel` é a taxonomia única (Decisão 14). Este
 * alias fica só para não partir os consumidores de uma vez; não introduzir
 * nenhuma taxonomia nova.
 */
export type SocialPlatformId = SocialChannel;

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
    /** Prefixar cada bloco com `1/N` (convenção de thread no X). */
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

/**
 * As manias de FORMATAÇÃO que não são limites — não estão no `platform-rules`
 * porque não interessam à IA, só ao colar do texto.
 */
const FORMATTING: Record<
    SocialChannel,
    Pick<
        PlatformPreset,
        'spacer' | 'blankLines' | 'hashtagGap' | 'numberTweets'
    >
> = {
    LINKEDIN: { spacer: true, blankLines: 1, hashtagGap: 1, numberTweets: false },
    INSTAGRAM: {
        // O Instagram remove trailing whitespace em algumas apps; o gap de
        // hashtags é feito com linhas em branco normais.
        spacer: false,
        blankLines: 1,
        hashtagGap: 4,
        numberTweets: false,
    },
    TWITTER: {
        spacer: false,
        blankLines: 1,
        hashtagGap: 1,
        numberTweets: true,
    },
    THREADS: { spacer: false, blankLines: 1, hashtagGap: 1, numberTweets: false },
    FACEBOOK: { spacer: false, blankLines: 1, hashtagGap: 1, numberTweets: false },
    PINTEREST: { spacer: false, blankLines: 1, hashtagGap: 1, numberTweets: false },
    TELEGRAM: { spacer: false, blankLines: 1, hashtagGap: 1, numberTweets: false },
    WHATSAPP: { spacer: false, blankLines: 1, hashtagGap: 1, numberTweets: false },
    TIKTOK: { spacer: false, blankLines: 1, hashtagGap: 1, numberTweets: false },
    YOUTUBE: { spacer: false, blankLines: 1, hashtagGap: 1, numberTweets: false },
};

// Os rótulos vêm de `CHANNEL_LABELS` (types/database), que é a fonte única —
// duplicá-los aqui era a razão de o menu dizer "X / Twitter" num sítio e
// "X (Twitter)" noutro.

/**
 * Constrói o preset de um canal, fundindo os overrides do utilizador.
 *
 * `rules` vem de `channel_configs.rules` — se o utilizador pôs `hashtagLimit: 5`
 * no Instagram, o medidor e o prompt de geração passam a dizer 5, e não 30.
 */
export function platformPresetFor(
    channel: SocialChannel,
    rules?: ResolvedChannelRules
): PlatformPreset {
    const resolved = rules ?? resolveRules({ channel });
    return {
        id: channel,
        label: CHANNEL_LABELS[channel],
        charLimit: resolved.charLimit,
        visibleChars: resolved.visibleChars,
        hashtagLimit: resolved.hashtagLimit,
        ...FORMATTING[channel],
    };
}

/** Preset com os defaults de código. */
export function defaultPlatformPreset(
    channel: SocialChannel
): PlatformPreset {
    return platformPresetFor(channel);
}

/** Presets de todos os canais do menu de copiar. */
export function allPlatformPresets(
    rulesByChannel?: Partial<Record<SocialChannel, ResolvedChannelRules>>
): PlatformPreset[] {
    return COPY_CHANNELS.map((channel) =>
        platformPresetFor(channel, rulesByChannel?.[channel])
    );
}

export const PLATFORM_IDS: readonly SocialPlatformId[] = COPY_CHANNELS;

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

export { aspectRatioFor };