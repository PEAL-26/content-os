/**
 * Catálogo único de regras e capacidades de plataforma.
 *
 * Absorveu `lib/social-text/platforms.ts`, que tinha uma taxonomia separada
 * (`SocialPlatformId = 'LINKEDIN'|'INSTAGRAM'|'X'|'THREADS'`, com `X` em vez de
 * `TWITTER`) e só cobria 4 canais. Agora há um só sítio — e ele cobre os 10.
 */
export {
    CHANNEL_CAPABILITIES,
    channelSupportsThread,
    channelSupportsType,
    sortTypesByFit,
} from './capabilities.js';
export type { ChannelCapabilities } from './capabilities.js';

export { CHANNEL_ASPECT_RATIO, CHANNEL_RULE_DEFAULTS, aspectRatioFor } from './defaults.js';

export {
    CHANNEL_RULE_FIELDS,
    channelRulesSchema,
    hasRuleOverrides,
    resolveRules,
} from './schema.js';
export type { ChannelRules, ChannelRulesSource, ResolvedChannelRules } from './schema.js';

export { MAX_CHANNEL_NOTES_CHARS, buildPlatformBlock } from './platform-block.js';
export type { PlatformBlockInput } from './platform-block.js';