import {
    buildCopy,
    buildPlainCopy,
    measureForPlatform,
    platformPresetFor,
    PLATFORM_IDS,
    UNICODE_STYLES,
    writeToClipboard,
    type CopySource,
    type PlatformPreset,
    type SocialPlatformId,
    type UnicodeStyleId,
} from '@/lib/social-text';
import { Menu } from '@base-ui/react/menu';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Preferências lembradas
// ---------------------------------------------------------------------------

const STYLE_KEY = 'contentos:copy-style';
const PLATFORM_KEY = 'contentos:copy-platform';

/** Ids válidos, para validar o que vem do `localStorage`. */
const STYLE_IDS = UNICODE_STYLES.map((s) => s.id);

function readStored<T extends string>(
    key: string,
    allowed: readonly T[]
): T | null {
    try {
        const value = window.localStorage.getItem(key);
        return value && (allowed as readonly string[]).includes(value)
            ? (value as T)
            : null;
    } catch {
        // `localStorage` lança em modo privado / cookies bloqueados. A
        // preferência é um extra: perder é aceitável.
        return null;
    }
}

function store(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Ver acima.
    }
}

// ---------------------------------------------------------------------------
// Estilo do menu
// ---------------------------------------------------------------------------

const POPUP_CLASSES =
    'z-50 min-w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg ' +
    'outline-none data-[ending-style]:scale-95 data-[starting-style]:scale-95 ' +
    'transition-transform duration-100';

const ITEM_CLASSES =
    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ' +
    'text-left text-sm text-gray-700 outline-none select-none ' +
    'data-[highlighted]:bg-gray-100 data-[highlighted]:text-gray-900';

const LABEL_CLASSES =
    'px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-gray-400';

function SubmenuArrow() {
    return <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CopyMenuProps {
    /** Peça ou roteiro a copiar. */
    source: CopySource;
    /** Texto por omissão; se nada vier, usa-se o conteúdo público da peça. */
    text?: string;
    disabled?: boolean;
    /**
     * Rótulo do botão. Varia com o contexto: o card é um ícone, a página de
     * detalhe um botão com texto.
     */
    variant?: 'icon' | 'button';
    /** Plataforma pré-sugerida, a partir do canal da peça. */
    defaultPlatform?: SocialPlatformId;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * Menu de copiar com dois eixos: formato e plataforma.
 *
 * O clipboard final leva os dois flavors — `text/plain` com caracteres Unicode
 * (para LinkedIn/IG/X, que só lêem texto simples) e `text/html` com tags reais
 * (para Notion, Docs, Gmail). Cada destino escolhe o que sabe ler.
 *
 * "Texto simples" fica sempre no topo: é a saída de emergência para quando a
 * conversão atrapalha (a pesquisa do LinkedIn não indexa texto Unicode, leitores
 * de ecrã leem "mathematical bold small a").
 */
export function CopyMenu({
    source,
    text: textOverride,
    disabled = false,
    variant = 'icon',
    defaultPlatform,
}: CopyMenuProps) {
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastChoice, setLastChoice] = useState<string | null>(null);

    // Lidos uma vez no mount. Reler `localStorage` em cada render mostraria um
    // menu que muda por baixo do utilizador; um initializer de `useState` faz
    // o mesmo trabalho sem o `ref` fora de render.
    const [style, setStyle] = useState<UnicodeStyleId>(
        () => readStored(STYLE_KEY, STYLE_IDS) ?? 'BOLD_SANS'
    );
    const [platform, setPlatform] = useState<SocialPlatformId>(
        () =>
            defaultPlatform ??
            readStored(PLATFORM_KEY, PLATFORM_IDS) ??
            'LINKEDIN'
    );

    const flashCopied = useCallback(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    const runCopy = useCallback(
        async (action: () => Promise<void>, choice: string) => {
            setError(null);
            try {
                await action();
                setLastChoice(choice);
                flashCopied();
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : 'Não foi possível copiar.'
                );
            }
        },
        [flashCopied]
    );

    /** Texto simples, sem conversão — o comportamento de sempre. */
    const copyPlain = useCallback(
        () =>
            runCopy(async () => {
                const text =
                    textOverride !== undefined
                        ? textOverride
                        : buildPlainCopy(source);
                await writeToClipboard({ text });
            }, 'plain'),
        [runCopy, source, textOverride]
    );

    /**
     * Formato social: Unicode + preset da plataforma.
     *
     * O preset da plataforma muda o texto (spacers do LinkedIn, gap das
     * hashtags no Instagram, numeração de tweets no X), por isso não basta
     * trocar o destino — o texto tem de ser reconstruído.
     */
    const copySocial = useCallback(
        (target: PlatformPreset, withStyle?: UnicodeStyleId) => {
            store(PLATFORM_KEY, target.id);
            if (withStyle) store(STYLE_KEY, withStyle);

            const chosenStyle = withStyle ?? style;
            if (withStyle) setStyle(withStyle);
            setPlatform(target.id);

            const text =
                textOverride !== undefined
                    ? textOverride
                    : buildCopy(source, {
                          style: chosenStyle,
                          platform: target,
                      }).text;

            return runCopy(
                () => writeToClipboard({ text }),
                `social:${target.id}`
            );
        },
        [runCopy, source, style, textOverride]
    );

    /** HTML rico, para destinos que saibam ler tags. */
    const copyHtml = useCallback(
        () =>
            runCopy(async () => {
                if (textOverride !== undefined) {
                    await writeToClipboard({ text: textOverride });
                    return;
                }
                const built = buildCopy(source, {
                    style,
                    platform: platformPresetFor(platform),
                });
                await writeToClipboard({
                    text: built.text,
                    html: built.html,
                });
            }, 'html'),
        [runCopy, source, style, platform, textOverride]
    );

    const trigger = (
        <Menu.Trigger
            disabled={disabled}
            className={
                variant === 'icon'
                    ? 'rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40'
                    : 'inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200'
            }
            title={variant === 'icon' ? 'Copiar conteúdo' : undefined}
            aria-label={variant === 'icon' ? 'Copiar conteúdo' : undefined}
        >
            {copied ? (
                <>
                    <Check className="h-4 w-4 text-green-600" />
                    {variant === 'button' && 'Copiado!'}
                </>
            ) : (
                <>
                    <Copy className="h-4 w-4" />
                    {variant === 'button' && 'Copiar'}
                    {variant === 'button' && (
                        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    )}
                </>
            )}
        </Menu.Trigger>
    );

    return (
        <>
            <Menu.Root>
                {trigger}
                <Menu.Portal>
                    <Menu.Positioner
                        sideOffset={6}
                        align="end"
                        className="z-50"
                    >
                        <Menu.Popup className={POPUP_CLASSES}>
                            <Menu.Item
                                className={ITEM_CLASSES}
                                onClick={() => void copyPlain()}
                            >
                                Texto simples
                                {lastChoice === 'plain' && (
                                    <Check className="ml-auto h-3.5 w-3.5 text-green-600" />
                                )}
                            </Menu.Item>

                            <Menu.Separator className="my-1 h-px bg-gray-100" />

                            <Menu.SubmenuRoot>
                                <Menu.SubmenuTrigger className={ITEM_CLASSES}>
                                    Formato social
                                    <SubmenuArrow />
                                </Menu.SubmenuTrigger>
                                <Menu.Portal>
                                    <Menu.Positioner
                                        sideOffset={4}
                                        align="start"
                                        className="z-50"
                                    >
                                        <Menu.Popup className={POPUP_CLASSES}>
                                            {/* `Menu.Group` é obrigatório:
                                                o `GroupLabel` dentro de um
                                                contexto sem grupo rebenta a
                                                árvore de React. */}
                                            <Menu.Group>
                                                <Menu.GroupLabel
                                                    className={LABEL_CLASSES}
                                                >
                                                    Estilo do negrito
                                                </Menu.GroupLabel>
                                                {UNICODE_STYLES.map(
                                                    (option) => (
                                                        <Menu.Item
                                                            key={option.id}
                                                            className={
                                                                ITEM_CLASSES
                                                            }
                                                            onClick={() =>
                                                                void copySocial(
                                                                    platformPresetFor(
                                                                        platform
                                                                    ),
                                                                    option.id
                                                                )
                                                            }
                                                        >
                                                            <span
                                                                className={`min-w-0 flex-1 truncate ${
                                                                    option.id ===
                                                                    style
                                                                        ? 'font-medium text-gray-900'
                                                                        : ''
                                                                }`}
                                                            >
                                                                {option.preview}
                                                            </span>
                                                            <span className="shrink-0 text-xs text-gray-400">
                                                                {option.label}
                                                            </span>
                                                        </Menu.Item>
                                                    )
                                                )}
                                            </Menu.Group>

                                            <Menu.Separator className="my-1 h-px bg-gray-100" />

                                            <Menu.Group>
                                                <Menu.GroupLabel
                                                    className={LABEL_CLASSES}
                                                >
                                                    Plataforma
                                                </Menu.GroupLabel>
                                                {PLATFORM_IDS.map((id) => {
                                                    const preset =
                                                        platformPresetFor(id);
                                                    // Cada opção mostra o custo
                                                    // *naquela* plataforma — o
                                                    // texto muda com o preset, e
                                                    // o limite também.
                                                    const status =
                                                        measureForPlatform(
                                                            previewTextFor(
                                                                source,
                                                                style,
                                                                preset,
                                                                textOverride
                                                            ),
                                                            preset
                                                        );
                                                    return (
                                                        <Menu.Item
                                                            key={id}
                                                            className={
                                                                ITEM_CLASSES
                                                            }
                                                            onClick={() =>
                                                                void copySocial(
                                                                    preset
                                                                )
                                                            }
                                                        >
                                                            <span
                                                                className={
                                                                    id ===
                                                                    platform
                                                                        ? 'font-medium text-gray-900'
                                                                        : ''
                                                                }
                                                            >
                                                                {preset.label}
                                                            </span>
                                                            <span
                                                                className={`ml-auto text-xs ${
                                                                    status.exceeds
                                                                        ? 'font-medium text-red-600'
                                                                        : status.hiddenByFold
                                                                          ? 'text-amber-600'
                                                                          : 'text-gray-400'
                                                                }`}
                                                                title={
                                                                    status.exceeds
                                                                        ? 'Excede o limite — a plataforma recusa ou trunca'
                                                                        : status.hiddenByFold
                                                                          ? `Passa do ponto de "see more" (${preset.visibleChars}) — o resto fica escondido`
                                                                          : undefined
                                                                }
                                                            >
                                                                {status.count}/
                                                                {status.limit}
                                                            </span>
                                                        </Menu.Item>
                                                    );
                                                })}
                                            </Menu.Group>
                                        </Menu.Popup>
                                    </Menu.Positioner>
                                </Menu.Portal>
                            </Menu.SubmenuRoot>

                            <Menu.Separator className="my-1 h-px bg-gray-100" />

                            <Menu.Item
                                className={ITEM_CLASSES}
                                onClick={() => void copyHtml()}
                            >
                                HTML rico
                                <span className="ml-auto text-xs text-gray-400">
                                    Docs, Notion
                                </span>
                            </Menu.Item>
                        </Menu.Popup>
                    </Menu.Positioner>
                </Menu.Portal>
            </Menu.Root>

            {error && (
                <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                    {error}
                </p>
            )}
        </>
    );
}

/** O texto que sairia para um preset — para o contador de cada opção. */
function previewTextFor(
    source: CopySource,
    style: UnicodeStyleId,
    platform: PlatformPreset,
    textOverride: string | undefined
): string {
    if (textOverride !== undefined) return textOverride;
    return buildCopy(source, { style, platform }).text;
}
