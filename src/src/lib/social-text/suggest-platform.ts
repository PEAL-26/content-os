/**
 * Sugere a plataforma do menu de copiar a partir da peça.
 *
 * Fica fora do componente (`copy-menu.tsx`) porque esse ficheiro só pode
 * exportar componentes: o react-refresh de Vite não recarrega bem um módulo
 * que mistura componente e função.
 *
 * O `id` da plataforma é o `SocialChannel` — a taxonomia do `platform-rules`.
 * Antes este ficheiro tinha o seu próprio tipo com `'X'`, que não existe no
 * enum da BD (lá é `TWITTER`).
 */

import type { SocialPlatformId } from '@/lib/social-text';
import { COPY_CHANNELS } from '@/lib/social-text/platforms';
import type { ContentPieceWithRelations, SocialChannel } from '@/types/database';

/**
 * Tipo da peça → plataforma mais provável, como fallback quando o canal não
 * está configurado. É o `CONTENT_FORMAT_DEFAULTS`, re-expresso aqui como
 * plataforma do menu de copiar (o destino mais óbvio para cada tipo).
 */
const FORMAT_PLATFORMS: Record<ContentPieceWithRelations['format'], SocialPlatformId> = {
    POST: 'LINKEDIN',
    CAROUSEL: 'INSTAGRAM',
    IMAGE: 'INSTAGRAM',
    SHORT_VIDEO: 'TIKTOK',
    VIDEO: 'YOUTUBE',
};

/** Canal do workspace → plataforma do menu, se for um destino de texto colado. */
function platformOfChannel(
    channel: SocialChannel | undefined
): SocialPlatformId | undefined {
    if (!channel) return undefined;
    return (COPY_CHANNELS as readonly SocialChannel[]).includes(channel)
        ? channel
        : undefined;
}

/**
 * Plataforma a sugerir para uma peça.
 *
 * O canal configurado no workspace ganha quando existe; senão cai no tipo.
 * `undefined` deixa o menu usar a preferência lembrada.
 */
export function suggestPlatformForPiece(
    piece: Pick<ContentPieceWithRelations, 'format' | 'channel'>
): SocialPlatformId | undefined {
    return (
        platformOfChannel(piece.channel?.channel) ??
        FORMAT_PLATFORMS[piece.format]
    );
}