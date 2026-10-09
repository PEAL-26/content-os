import type { PublicationTargetType, SocialChannel } from '@/types/database';

// =============================================================================
// Publicações multi-plataforma
//
// A plataforma deixou de ser texto livre (Decisão 34): `content_publications
// .platform` passou a ser o enum `SocialChannel`. Isto tem duas consequências
// que este módulo centraliza:
//
//   1. `X_TWITTER` e `outros` NÃO existem no enum. Escrevê-los rebentava o
//      insert com `invalid input value for enum` — ou seja, "marcar como
//      publicado" deixava de funcionar.
//   2. O enum tem 10 canais; esta lista tinha 7. Os que faltavam estão aqui.
//
// Uma só lista, importada pelos dois painéis, para que não voltem a divergir.
// =============================================================================

/** Canais que se podem marcar como publicados, por ordem de uso provável. */
export const PUBLICATION_PLATFORMS: readonly {
    value: SocialChannel;
    label: string;
}[] = [
    { value: 'LINKEDIN', label: 'LinkedIn' },
    { value: 'INSTAGRAM', label: 'Instagram' },
    { value: 'TIKTOK', label: 'TikTok' },
    { value: 'YOUTUBE', label: 'YouTube' },
    { value: 'TWITTER', label: 'X (Twitter)' },
    { value: 'FACEBOOK', label: 'Facebook' },
    { value: 'THREADS', label: 'Threads' },
    { value: 'PINTEREST', label: 'Pinterest' },
    { value: 'TELEGRAM', label: 'Telegram' },
    { value: 'WHATSAPP', label: 'WhatsApp' },
];

export type PublicationTargetTypeExport = PublicationTargetType;

/**
 * Plataforma por omissão quando o utilizador não escolheu uma.
 *
 * Antes era `'outros'`, que deixou de existir no enum. `LINKEDIN` é o canal
 * principal por defeito no `createDefaultChannels`, por isso é o menos
 * surpreendente como fallback.
 */
export const DEFAULT_PUBLICATION_PLATFORM: SocialChannel = 'LINKEDIN';

/** Normaliza o que vem do formulário para um valor do enum. */
export function toPublicationPlatform(value: string): SocialChannel {
    const match = PUBLICATION_PLATFORMS.find(
        (p) => p.value === (value as SocialChannel)
    );
    return match?.value ?? DEFAULT_PUBLICATION_PLATFORM;
}