import type { ContentFormat, SocialChannel } from '../../types/database.js';

/**
 * Matriz de capacidades por plataforma.
 *
 * Isto NÃO bloqueia nada. Serve para três coisas:
 *   1. ordenar os tipos no picker (os que fazem sentido primeiro);
 *   2. avisar o utilizador quando escolhe um tipo não-nativo;
 *   3. redigir a instrução de adaptação que vai no bloco de plataforma.
 *
 * Um canal que "não suporta" um tipo continua a aceitá-lo — a IA é instruída
 * a adaptar. Ver `platform-block.ts`.
 */
export interface ChannelCapabilities {
    /** Posts com sequência de slides/imagens (feed IG, documento LinkedIn, carrossel X). */
    supportsCarousel: boolean;
    /** Texto encadeado numerado (thread de X/Threads, sequência LinkedIn). */
    supportsThread: boolean;
    /** Publicação só com imagem + legenda. */
    supportsImage: boolean;
    /** Vídeo curto vertical (Reels, TikTok, Shorts). */
    supportsShortVideo: boolean;
    /** Vídeo longo (YouTube, vídeo de LinkedIn, Facebook). */
    supportsLongVideo: boolean;
    /** Narração em áudio sobre o vídeo. */
    supportsAudio: boolean;
}

export const CHANNEL_CAPABILITIES: Record<SocialChannel, ChannelCapabilities> = {
    LINKEDIN: {
        supportsCarousel: true,
        supportsThread: true,
        supportsImage: true,
        supportsShortVideo: true,
        supportsLongVideo: true,
        supportsAudio: true,
    },
    INSTAGRAM: {
        supportsCarousel: true,
        supportsThread: false,
        supportsImage: true,
        supportsShortVideo: true,
        supportsLongVideo: false,
        supportsAudio: true,
    },
    TIKTOK: {
        supportsCarousel: false,
        supportsThread: false,
        supportsImage: true,
        supportsShortVideo: true,
        supportsLongVideo: false,
        supportsAudio: true,
    },
    YOUTUBE: {
        supportsCarousel: false,
        supportsThread: false,
        supportsImage: true,
        supportsShortVideo: true,
        supportsLongVideo: true,
        supportsAudio: true,
    },
    TWITTER: {
        supportsCarousel: true,
        supportsThread: true,
        supportsImage: true,
        supportsShortVideo: false,
        supportsLongVideo: false,
        supportsAudio: false,
    },
    FACEBOOK: {
        supportsCarousel: false,
        supportsThread: false,
        supportsImage: true,
        supportsShortVideo: true,
        supportsLongVideo: true,
        supportsAudio: true,
    },
    THREADS: {
        supportsCarousel: false,
        supportsThread: true,
        supportsImage: true,
        supportsShortVideo: false,
        supportsLongVideo: false,
        supportsAudio: false,
    },
    PINTEREST: {
        supportsCarousel: false,
        supportsThread: false,
        supportsImage: true,
        supportsShortVideo: true,
        supportsLongVideo: false,
        supportsAudio: false,
    },
    TELEGRAM: {
        supportsCarousel: false,
        supportsThread: false,
        supportsImage: true,
        supportsShortVideo: false,
        supportsLongVideo: false,
        supportsAudio: true,
    },
    WHATSAPP: {
        supportsCarousel: false,
        supportsThread: false,
        supportsImage: true,
        supportsShortVideo: false,
        supportsLongVideo: false,
        supportsAudio: true,
    },
};

/** Capacidade que decide se um tipo é nativo no canal. */
const TYPE_CAPABILITY: Record<ContentFormat, keyof ChannelCapabilities> = {
    POST: 'supportsImage',
    CAROUSEL: 'supportsCarousel',
    IMAGE: 'supportsImage',
    SHORT_VIDEO: 'supportsShortVideo',
    VIDEO: 'supportsLongVideo',
};

/** `true` quando o canal tem o formato de forma nativa. */
export function channelSupportsType(
    channel: SocialChannel,
    type: ContentFormat
): boolean {
    return CHANNEL_CAPABILITIES[channel][TYPE_CAPABILITY[type]];
}

/**
 * O canal suporta threads? Só os três que as têm de facto. Um "thread pedido
 * no Instagram" é um POST normal — não há nada a adaptar.
 */
export function channelSupportsThread(channel: SocialChannel): boolean {
    return CHANNEL_CAPABILITIES[channel].supportsThread;
}

/**
 * Ordena os tipos para o picker: nativos primeiro (por uma ordem estável e
 * previsível), depois os não-nativos. **Nunca remove** nenhum — o utilizador
 * pode sempre escolher qualquer tipo para qualquer canal.
 */
export function sortTypesByFit(
    channel: SocialChannel,
    types: readonly ContentFormat[]
): ContentFormat[] {
    const NATIVE_ORDER: readonly ContentFormat[] = [
        'POST',
        'IMAGE',
        'CAROUSEL',
        'SHORT_VIDEO',
        'VIDEO',
    ];
    const native: ContentFormat[] = [];
    const other: ContentFormat[] = [];
    for (const type of NATIVE_ORDER) {
        if (!types.includes(type)) continue;
        (channelSupportsType(channel, type) ? native : other).push(type);
    }
    return [...native, ...other];
}