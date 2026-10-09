import type { ContentFormat, SocialChannel } from '../../types/database.js';
import { CHANNEL_LABELS, CONTENT_FORMAT_LABELS } from '../../types/database.js';
import { channelSupportsThread, channelSupportsType } from './capabilities.js';
import type { ResolvedChannelRules } from './schema.js';

/** Tecto das instruções do canal — acima disso a IA deixa de as seguir. */
export const MAX_CHANNEL_NOTES_CHARS = 2000;

export interface PlatformBlockInput {
    channel: SocialChannel;
    /** `channel_configs.handle` — "@conta" ou URL. Opcional. */
    handle?: string | null;
    type: ContentFormat;
    rules: ResolvedChannelRules;
    /** `channel_configs.defaultTone`. Sobrepõe o voiceTone do workspace. */
    defaultTone?: string | null;
    /** `channel_configs.notes` — instruções do utilizador para este canal. */
    notes?: string | null;
}

/**
 * Como adaptar um tipo que o canal não tem de forma nativa.
 *
 * Não bloqueamos nada (ver `capabilities.ts`), mas a IA tem de saber o que
 * fazer — sem isto, "carrossel para WhatsApp" produz slides que não existem lá.
 */
function adaptationNote(channel: SocialChannel, type: ContentFormat): string | null {
    const label = CHANNEL_LABELS[channel];

    if (type === 'CAROUSEL' && !channelSupportsType(channel, 'CAROUSEL')) {
        return `- O tipo pedido (carrossel) não é nativo no ${label}. Adapta-o a um texto sequencial numerado (1., 2., 3., ...), sem depender de imagens.`;
    }
    if (type === 'SHORT_VIDEO' && !channelSupportsType(channel, 'SHORT_VIDEO')) {
        return `- O tipo pedido (vídeo curto) não é nativo no ${label}. Adapta-o a um formato de texto que o canal suporte, mantendo a estrutura de cenas.`;
    }
    if (type === 'VIDEO' && !channelSupportsType(channel, 'VIDEO')) {
        return `- O tipo pedido (vídeo longo) não é nativo no ${label}. Adapta-o a um formato de texto que o canal suporte, mantendo a estrutura de cenas.`;
    }
    if (type === 'IMAGE' && !channelSupportsType(channel, 'IMAGE')) {
        return `- O tipo pedido (imagem) não é nativo no ${label}. Adapta-o a texto corrido.`;
    }
    if (type === 'POST' && channelSupportsThread(channel)) {
        return `- Este canal suporta threads encadeadas. Se o conteúdo tiver mais do que uma ideia, estrutura-o como posts numerados (1/N, 2/N, ...) em vez de um bloco único.`;
    }
    return null;
}

/**
 * BLOCO DE PLATAFORMA — fixo, NÃO editável.
 *
 * Injetado DEPOIS do prompt de sistema editável (`withAdditionalInstructions`,
 * em `server/generation/context.ts`). É esta separação que fecha o bug: o
 * prompt editável é por TIPO, e as regras de plataforma entram aqui, onde
 * nenhum override os consegue contaminar.
 */
export function buildPlatformBlock(input: PlatformBlockInput): string {
    const { channel, handle, type, rules, defaultTone, notes } = input;
    const label = CHANNEL_LABELS[channel];
    const lines: string[] = [];

    lines.push(`## Canal: ${label}${handle ? ` (${handle})` : ''}`);
    lines.push('');
    lines.push('### Regras da plataforma');
    lines.push(`- Limite: ${rules.charLimit} caracteres`);
    lines.push(
        `- Visível sem truncar: ~${rules.visibleChars} caracteres${rules.visibleChars < rules.charLimit ? ' (depois disso aparece "ver mais")' : ''}`
    );
    lines.push(
        rules.hashtagLimit > 0
            ? `- Hashtags: máximo ${rules.hashtagLimit}`
            : '- Hashtags: não usar (este canal não as suporta)'
    );
    lines.push(`- Extensão: ${rules.wordRangeMin}-${rules.wordRangeMax} palavras`);
    lines.push(`- Tom de voz da plataforma: ${rules.tone}`);
    lines.push(`- Tipo pedido: ${CONTENT_FORMAT_LABELS[type]}`);

    const tone = defaultTone?.trim();
    if (tone) {
        lines.push('');
        lines.push('### Tom deste canal');
        lines.push(`- ${tone}`);
    }

    const instructions = notes?.trim().slice(0, MAX_CHANNEL_NOTES_CHARS);
    if (instructions) {
        lines.push('');
        lines.push('### Instruções deste canal');
        lines.push(
            instructions
                .split('\n')
                .map((line) => `- ${line}`)
                .join('\n')
        );
    }

    const adaptation = adaptationNote(channel, type);
    if (adaptation) {
        lines.push('');
        lines.push('### Adaptação necessária');
        lines.push(adaptation);
    }

    return lines.join('\n');
}