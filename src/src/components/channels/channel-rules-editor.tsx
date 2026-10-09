import {
    hasRuleOverrides,
    resolveRules,
    type ResolvedChannelRules,
} from '@/lib/platform-rules';
import type { SocialChannel } from '@/types/database';
import { CHANNEL_LABELS } from '@/types/database';

// =============================================================================
// Editor das REGRAS de plataforma de um canal.
//
// Os overrides vivem em `channel_configs.rules` (JSONB) e são fundidos
// campo-a-campo sobre os defaults de código (ver `resolveRules`). Cada campo
// vazio = herdar o default, por isso um valor novo acrescentado ao catálogo
// aparece aqui sem migração e sem fossilizar valores.
//
// Os valores efectivos (default + override) aparecem à medida que o utilizador
// muda, para nunca ter de adivinhar o que a IA vai receber.
// =============================================================================

export interface ChannelRulesEditorProps {
    channel: SocialChannel;
    /** O `rules` cru da coluna (pode ser lixo vindo de uma edição manual). */
    rules: unknown;
    onChange: (rules: Record<string, unknown> | null) => void;
    disabled?: boolean;
}

type NumericField =
    | 'charLimit'
    | 'visibleChars'
    | 'hashtagLimit'
    | 'wordRangeMin'
    | 'wordRangeMax';

const NUMERIC_FIELDS: {
    key: NumericField;
    label: string;
    hint: string;
}[] = [
    {
        key: 'charLimit',
        label: 'Limite de caracteres',
        hint: 'Máximo que a plataforma aceita numa publicação.',
    },
    {
        key: 'visibleChars',
        label: 'Visíveis antes de truncar',
        hint: 'Onde aparece o "ver mais". Afecta onde se deve pôr a mensagem.',
    },
    {
        key: 'hashtagLimit',
        label: 'Máximo de hashtags',
        hint: '0 = a plataforma não aceita hashtags.',
    },
    {
        key: 'wordRangeMin',
        label: 'Mínimo de palavras',
        hint: 'Extensão mínima recomendada do texto.',
    },
    {
        key: 'wordRangeMax',
        label: 'Máximo de palavras',
        hint: 'Extensão máxima recomendada do texto.',
    },
];

const ASPECT_RATIOS = ['1:1', '4:5', '2:3', '9:16', '16:9', '3:2', '1.91:1'];

export function ChannelRulesEditor({
    channel,
    rules,
    onChange,
    disabled = false,
}: ChannelRulesEditorProps) {
    const source: ChannelRulesSource = { channel, rules };
    const resolved: ResolvedChannelRules = resolveRules(source);
    const overrides = hasRuleOverrides(source);

    // O que está guardado, isolado (o que o utilizador escreveu por cima).
    const stored = (
        rules && typeof rules === 'object' && !Array.isArray(rules)
            ? (rules as Record<string, unknown>)
            : {}
    );

    const update = (key: string, value: unknown) => {
        const next = { ...stored };
        if (value === null || value === '') {
            delete next[key];
        } else {
            next[key] = value;
        }
        // Tudo vazio = `null` (a coluna fica sem overrides e herda tudo).
        onChange(Object.keys(next).length === 0 ? null : next);
    };

    return (
        <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-gray-700">
                    Regras de {CHANNEL_LABELS[channel]}
                </span>
                <span className="text-[10px] text-gray-400">
                    {overrides
                        ? 'Ajustadas por ti'
                        : 'Defaults da plataforma (vazio = herdar)'}
                </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                {NUMERIC_FIELDS.map((field) => {
                    const storedValue = stored[field.key];
                    const isOverridden =
                        typeof storedValue === 'number' ||
                        typeof storedValue === 'string';
                    return (
                        <div key={field.key}>
                            <label
                                htmlFor={`rule-${channel}-${field.key}`}
                                className="block text-[11px] text-gray-600"
                                title={field.hint}
                            >
                                {field.label}
                                {isOverridden && (
                                    <span className="ml-1 text-purple-600">
                                        •
                                    </span>
                                )}
                            </label>
                            <input
                                id={`rule-${channel}-${field.key}`}
                                type="number"
                                // `stored[field.key]` pode ser lixo vindo de uma
                                // edição manual — o input tem de mostrar
                                // string/número, nunca `{}`.
                                value={
                                    typeof storedValue === 'number' ||
                                    typeof storedValue === 'string'
                                        ? storedValue
                                        : ''
                                }
                                placeholder={String(resolved[field.key])}
                                onChange={(e) =>
                                    update(
                                        field.key,
                                        e.target.value
                                            ? Number(e.target.value)
                                            : null
                                    )
                                }
                                disabled={disabled}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                            />
                        </div>
                    );
                })}
            </div>

            <div>
                <label className="block text-[11px] text-gray-600">
                    Tom de voz da plataforma
                </label>
                <input
                    type="text"
                    value={typeof stored.tone === 'string' ? stored.tone : ''}
                    placeholder={resolved.tone}
                    onChange={(e) => update('tone', e.target.value)}
                    disabled={disabled}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                />
            </div>

            <div>
                <label className="block text-[11px] text-gray-600">
                    Formato preferido para imagem/vídeo
                </label>
                <select
                    value={
                        typeof stored.aspectRatio === 'string'
                            ? stored.aspectRatio
                            : ''
                    }
                    onChange={(e) => update('aspectRatio', e.target.value)}
                    disabled={disabled}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                >
                    <option value="">
                        Padrão ({resolved.aspectRatio})
                    </option>
                    {ASPECT_RATIOS.map((ratio) => (
                        <option key={ratio} value={ratio}>
                            {ratio}
                        </option>
                    ))}
                </select>
                <p className="mt-0.5 text-[10px] text-gray-400">
                    Vai como parâmetro para o gerador de imagem — nunca dentro
                    do prompt, para o prompt continuar portátil.
                </p>
            </div>

            <p className="text-[10px] text-gray-400">
            A extensão recomendada vai para a IA como{' '}
            <strong>
                {resolved.wordRangeMin}–{resolved.wordRangeMax} palavras
            </strong>{' '}
            e o limite como <strong>{resolved.charLimit}</strong> caracteres.
            </p>
        </div>
    );
}

/** O que o editor precisa saber sobre o canal para fundir as regras. */
type ChannelRulesSource = { channel: SocialChannel; rules: unknown };