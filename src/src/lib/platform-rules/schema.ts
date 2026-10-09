import { z } from 'zod';
import type { SocialChannel } from '../../types/database.js';
import { CHANNEL_ASPECT_RATIO, CHANNEL_RULE_DEFAULTS } from './defaults.js';

/**
 * Regras de plataforma, por canal.
 *
 * Todos os campos são opcionais: um override só declara o que muda. O merge é
 * campo-a-campo (`resolveRules`) para que os canais já criados nunca fiquem
 * com valores fossilizados quando uma regra nova for acrescentada ao catálogo.
 */
export const channelRulesSchema = z
    .object({
        /** Limite de caracteres da publicação. */
        charLimit: z.number().int().positive().max(100_000).optional(),
        /** Caracteres visíveis antes de "ver mais" — orienta a estrutura. */
        visibleChars: z.number().int().positive().max(100_000).optional(),
        hashtagLimit: z.number().int().min(0).max(100).optional(),
        wordRangeMin: z.number().int().positive().max(10_000).optional(),
        wordRangeMax: z.number().int().positive().max(10_000).optional(),
        tone: z.string().min(1).max(400).optional(),
        /** Aspecto preferido para imagem/vídeo (ex: "4:5"). Fora do prompt. */
        aspectRatio: z.string().min(1).max(20).optional(),
    })
    .partial();

export type ChannelRules = z.infer<typeof channelRulesSchema>;

/** Regras completas: defaults + overrides, sem `undefined`. */
export type ResolvedChannelRules = Required<ChannelRules>;

/** Campos que o editor de regras expõe (para a UI e para validar o Json). */
export const CHANNEL_RULE_FIELDS = [
    'charLimit',
    'visibleChars',
    'hashtagLimit',
    'wordRangeMin',
    'wordRangeMax',
    'tone',
    'aspectRatio',
] as const satisfies readonly (keyof ChannelRules)[];

export interface ChannelRulesSource {
    channel: SocialChannel;
    /** Conteúdo cru de `channel_configs.rules` (Json da BD). */
    rules?: unknown;
}

/**
 * Funde os overrides do canal sobre os defaults de código, campo a campo.
 *
 * Tolera três tipos de lixo que a coluna JSONB pode conter sem ninguém dar por
 * isso (editado à mão, vindo de uma migração, syncing antigo):
 *   - não é um objecto        → ignora tudo
 *   - campo com tipo errado   → descarta só esse campo
 *   - `wordRangeMax < Min`    → descarta o par (não faz sentido)
 */
export function resolveRules(source: ChannelRulesSource): ResolvedChannelRules {
    const base = CHANNEL_RULE_DEFAULTS[source.channel];
    const merged: ResolvedChannelRules = {
        ...base,
        aspectRatio: CHANNEL_ASPECT_RATIO[source.channel],
    };

    if (!source.rules || typeof source.rules !== 'object' || Array.isArray(source.rules)) {
        return merged;
    }

    // ⚠️ Validação CAMPO A CAMPO, e não um `safeParse` do objecto inteiro.
    //
    // O Zod é estrito: um único campo com o tipo errado faz `safeParse` falhar
    // na TOTALIDADE, e o `return fallback` descartava também os campos válidos.
    // Ou seja, um `hashtagLimit: "cinco"` à mão no editor fazia o utilizador
    // perder também o `charLimit` que tinha escrito logo a seguir.
    //
    // `pickNumber`/`pickString` são o que garante o contrato: um campo inválido
    // é descartado sozinho e os restantes são aplicados.
    const raw = source.rules as Record<string, unknown>;

    const charLimit = pickNumber(raw.charLimit, 'charLimit');
    if (charLimit !== undefined) merged.charLimit = charLimit;

    const visibleChars = pickNumber(raw.visibleChars, 'visibleChars');
    if (visibleChars !== undefined) merged.visibleChars = visibleChars;

    const hashtagLimit = pickNumber(raw.hashtagLimit, 'hashtagLimit');
    if (hashtagLimit !== undefined) merged.hashtagLimit = hashtagLimit;

    const tone = pickString(raw.tone);
    if (tone !== undefined) merged.tone = tone;

    const aspectRatio = pickString(raw.aspectRatio);
    if (aspectRatio !== undefined) merged.aspectRatio = aspectRatio;

    // O par de extensão tem de fazer sentido; senão herdamos os dois.
    const wordRangeMin = pickNumber(raw.wordRangeMin, 'wordRangeMin');
    const wordRangeMax = pickNumber(raw.wordRangeMax, 'wordRangeMax');
    if (wordRangeMin !== undefined && wordRangeMax !== undefined) {
        if (wordRangeMin <= wordRangeMax) {
            merged.wordRangeMin = wordRangeMin;
            merged.wordRangeMax = wordRangeMax;
        }
    } else if (wordRangeMin !== undefined && wordRangeMin <= merged.wordRangeMax) {
        merged.wordRangeMin = wordRangeMin;
    } else if (wordRangeMax !== undefined && wordRangeMax >= merged.wordRangeMin) {
        merged.wordRangeMax = wordRangeMax;
    }

    // O "visível antes de ver mais" nunca pode exceder o limite total.
    if (merged.visibleChars > merged.charLimit) {
        merged.visibleChars = merged.charLimit;
    }

    return merged;
}

/**
 * Valida UM campo numérico contra o seu schema.
 *
 * Reutiliza o schema Zod por campo em vez de repetir as regras em código — é
 * o que garante que o `max`/`min` aqui e no schema não divergem.
 */
function pickNumber(value: unknown, field: string): number | undefined {
    if (value === undefined || value === null) return undefined;
    const schema = channelRulesSchema.shape[field as keyof typeof channelRulesSchema.shape];
    const result = schema.safeParse(value);
    return result.success ? (result.data as number) : undefined;
}

function pickString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * `true` quando o canal tem pelo menos um override **válido**.
 *
 * Conta só campos que passam a validação (mesma lógica campo-a-campo de
 * `resolveRules`), para a UI não dizer "tens regras customizadas" quando o que
 * está guardado é lixo que vai ser descartado.
 */
export function hasRuleOverrides(source: ChannelRulesSource): boolean {
    if (!source.rules || typeof source.rules !== 'object' || Array.isArray(source.rules)) {
        return false;
    }
    const raw = source.rules as Record<string, unknown>;

    const numericFields = [
        'charLimit',
        'visibleChars',
        'hashtagLimit',
        'wordRangeMin',
        'wordRangeMax',
    ] as const;
    for (const field of numericFields) {
        if (pickNumber(raw[field], field) !== undefined) return true;
    }
    return pickString(raw.tone) !== undefined || pickString(raw.aspectRatio) !== undefined;
}