import type { SocialChannel } from '../../types/database.js';
import type { ChannelRules } from './schema.js';

/**
 * Defaults de plataforma — a FONTE DA VERDADE.
 *
 * Os overrides do utilizador vivem em `channel_configs.rules` (JSONB) e são
 * fundidos campo-a-campo por `resolveRules()`. Um campo `null`/ausente herda
 * este default, por isso acrescentar uma regra nova aqui não obriga a backfill
 * nem fossiliza valores nos canais já existentes.
 *
 * Os valores de char/hashtag vêm do antigo `lib/social-text/platforms.ts`, que
 * foi absorvido por este módulo para haver uma taxonomia só.
 */
/**
 * O `aspectRatio` NÃO vive aqui: tem a sua própria tabela abaixo, porque é um
 * valor por plataforma (não uma regra editorial) e alimenta o parâmetro da API.
 * Aqui só vivem as regras de escrita.
 */
type EditorialRules = Omit<Required<ChannelRules>, 'aspectRatio'>;

export const CHANNEL_RULE_DEFAULTS: Record<SocialChannel, EditorialRules> = {
    LINKEDIN: {
        charLimit: 3000,
        visibleChars: 210,
        hashtagLimit: 3,
        wordRangeMin: 150,
        wordRangeMax: 300,
        tone: 'profissional, directo, orientado a valor para gestores',
    },
    INSTAGRAM: {
        charLimit: 2200,
        visibleChars: 125,
        hashtagLimit: 8,
        wordRangeMin: 50,
        wordRangeMax: 150,
        tone: 'casual, visual, acessível',
    },
    TIKTOK: {
        charLimit: 2200,
        visibleChars: 100,
        hashtagLimit: 5,
        wordRangeMin: 40,
        wordRangeMax: 120,
        tone: 'casual, rápido, directo ao ponto, com energia',
    },
    YOUTUBE: {
        charLimit: 5000,
        visibleChars: 200,
        hashtagLimit: 15,
        wordRangeMin: 200,
        wordRangeMax: 400,
        tone: 'elaborado, didático, com contexto e exemplos',
    },
    TWITTER: {
        charLimit: 280,
        visibleChars: 280,
        hashtagLimit: 1,
        wordRangeMin: 20,
        wordRangeMax: 45,
        tone: 'sucinto, opinativo, com uma ideia por publicação',
    },
    FACEBOOK: {
        charLimit: 63206,
        visibleChars: 480,
        hashtagLimit: 3,
        wordRangeMin: 80,
        wordRangeMax: 250,
        tone: 'conversacional, próximo do utilizador, com contexto',
    },
    THREADS: {
        charLimit: 500,
        visibleChars: 500,
        hashtagLimit: 3,
        wordRangeMin: 40,
        wordRangeMax: 120,
        tone: 'conversacional, espontâneo, como uma conversa',
    },
    PINTEREST: {
        charLimit: 500,
        visibleChars: 100,
        hashtagLimit: 10,
        wordRangeMin: 20,
        wordRangeMax: 80,
        tone: 'inspiracional, visual, focado em intenção de compra',
    },
    TELEGRAM: {
        charLimit: 4096,
        visibleChars: 4096,
        hashtagLimit: 3,
        wordRangeMin: 120,
        wordRangeMax: 400,
        tone: 'directo, informativo, com referência clara à acção',
    },
    WHATSAPP: {
        charLimit: 4096,
        visibleChars: 4096,
        hashtagLimit: 0,
        wordRangeMin: 40,
        wordRangeMax: 150,
        tone: 'próximo, simples, sem jargão — é uma conversa privada',
    },
};

/**
 * Aspecto preferido por plataforma. Vai FORA do prompt de media, como
 * parâmetro da API — o prompt tem de continuar portátil (ver Decisão 29).
 */
export const CHANNEL_ASPECT_RATIO: Record<SocialChannel, string> = {
    LINKEDIN: '1:1',
    INSTAGRAM: '4:5',
    TIKTOK: '9:16',
    YOUTUBE: '16:9',
    TWITTER: '16:9',
    FACEBOOK: '1.91:1',
    THREADS: '1:1',
    PINTEREST: '2:3',
    TELEGRAM: '1:1',
    WHATSAPP: '1:1',
};

/** Aspecto a usar para imagens/vídeo, com override opcional do canal. */
export function aspectRatioFor(channel: SocialChannel, override?: string | null): string {
    return override?.trim() || CHANNEL_ASPECT_RATIO[channel] || '1:1';
}