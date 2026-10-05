/**
 * Sugere a plataforma do menu de copiar a partir da peça ou do roteiro.
 *
 * Fica fora do componente (`copy-menu.tsx`) porque esse ficheiro só pode
 * exportar componentes: o react-refresh de Vite não recarrega bem um módulo
 * que mistura componente e função.
 */

import type { SocialPlatformId } from '@/lib/social-text';
import type {
    ContentFormat,
    ContentPieceWithRelations,
    SocialChannel,
} from '@/types/database';

/**
 * Formato da peça → plataforma mais provável.
 *
 * Uma peça de Instagram não faz sentido formatada para o limite de 280 do X, por
 * isso o menu parte do formato em vez de começar sempre no LinkedIn.
 */
const FORMAT_PLATFORMS: Record<ContentFormat, SocialPlatformId> = {
    CAROUSEL: 'LINKEDIN',
    LINKEDIN_POST: 'LINKEDIN',
    CTA_POST: 'LINKEDIN',
    IMAGE: 'INSTAGRAM',
    THREAD: 'X',
    SHORT_VIDEO: 'INSTAGRAM',
    VIDEO_SCRIPT: 'INSTAGRAM',
};

/** Canal do workspace → plataforma do menu. */
function platformOfChannel(
    channel: SocialChannel | undefined
): SocialPlatformId | undefined {
    switch (channel) {
        case 'LINKEDIN':
            return 'LINKEDIN';
        case 'INSTAGRAM':
            return 'INSTAGRAM';
        case 'TWITTER':
            return 'X';
        default:
            // TikTok e YouTube não são destinos onde se cole texto formatado.
            return undefined;
    }
}

/**
 * Plataforma a sugerir para uma peça.
 *
 * O canal configurado no workspace ganha quando existe; senão cai no formato.
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

/** Plataforma a sugerir a partir do canal de um roteiro. */
export function suggestPlatformForScript(
    channel: SocialChannel | undefined
): SocialPlatformId | undefined {
    return platformOfChannel(channel);
}