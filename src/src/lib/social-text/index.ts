/**
 * Copiar conteúdo formatado para redes sociais.
 *
 * O ponto de entrada é `buildCopy` + `writeToClipboard`:
 *
 * ```ts
 * const { text, html } = buildCopy(
 *     { type: 'piece', piece },
 *     { style: 'BOLD_SANS', platform: PLATFORM_PRESETS.LINKEDIN }
 * );
 * await writeToClipboard({ text, html });
 * ```
 */

export {
    UNICODE_STYLES,
    applyStyle,
    hasUnicodeStyling,
    type UnicodeStyle,
    type UnicodeStyleId,
} from './unicode-styles';

export {
    BRAILLE_BLANK,
    PLATFORM_IDS,
    PLATFORM_PRESETS,
    countUtf16,
    measureForPlatform,
    normaliseHashtag,
    type CharCountStatus,
    type PlatformPreset,
    type SocialPlatformId,
} from './platforms';

export {
    buildBlocks,
    buildCopy,
    buildPlainCopy,
    parseBody,
    parseInline,
    renderHtml,
    renderPlain,
    type BuiltCopy,
    type CopyBlock,
    type CopySource,
    type Emphasis,
    type Span,
} from './build-copy';

export {
    suggestPlatformForPiece,
    suggestPlatformForScript,
} from './suggest-platform';

export {
    CLIPBOARD_ERROR_MESSAGE,
    supportsHtmlClipboard,
    writeToClipboard,
    type ClipboardPayload,
} from './clipboard';
