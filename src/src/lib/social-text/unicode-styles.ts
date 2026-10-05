/**
 * Estilos de caractere Unicode para texto que vai para campos de texto simples
 * (LinkedIn, Instagram, X, Threads), onde HTML é descartado e markdown não é
 * renderizado.
 *
 * A ideia: um campo de texto simples não tem "negrito", mas o bloco
 * *Mathematical Alphanumeric Symbols* (U+1D400–U+1D7FF) tem caracteres que
 * *parecem* negrito/itálico. Trocar `A` por `𝗔` é o truque — o "formato" passa a
 * estar dentro do próprio carácter, por isso sobrevive a qualquer copy/paste.
 *
 * Referência: https://yaytext.com/pt/
 *
 * ---------------------------------------------------------------------------
 * As três armadilhas que esta tabela tem de respeitar
 * ---------------------------------------------------------------------------
 *
 * 1. **Acentos.** O bloco só define `A-Z a-z 0-9`. Não existe `ã`, `ç` ou `é` em
 *    negrito. Sem tratamento, "conclusão" sai a meio negrito a meio não. A
 *    solução é a normalização NFD: `ã`.normalize('NFD') dá `a` + U+0303
 *    (tilde combinante). Estiliza-se a base, que existe, e repõe-se a marca.
 *
 * 2. **A excepção do `h` itálico.** U+1D455 está reservado pela Unicode para
 *    acomodar U+210E (ℌ). Mapear 'h' → U+1D455 produz um caractere não atribuído.
 *
 * 3. **Whitespace nos estilos de marca.** U+0336/U+0332 num espaço desenha uma
 *    barra flutuante isolada. Estes estilos saltam whitespace.
 */

/** Identificadores dos estilos suportados. */
export type UnicodeStyleId =
    | 'BOLD_SERIF'
    | 'ITALIC_SERIF'
    | 'BOLD_ITALIC_SERIF'
    | 'BOLD_SANS'
    | 'ITALIC_SANS'
    | 'BOLD_ITALIC_SANS'
    | 'STRIKETHROUGH'
    | 'UNDERLINE';

export interface UnicodeStyle {
    id: UnicodeStyleId;
    label: string;
    /** Exemplo curto para pré-visualização no menu. */
    preview: string;
}

/**
 * Os 8 estilos suportados — só os que renderizam em qualquer dispositivo.
 *
 * Fica de fora de propósito o catálogo do YayText (cursiva, gótico, small caps,
 * bolha, fullwidth, circled, squared, katakana): vários desses blocos não têm
 * glifo em Android antigo nem em keyboards de gama baixa e saem como caixas
 * (▯). Para conteúdo B2B não compensam.
 */
export const UNICODE_STYLES: readonly UnicodeStyle[] = [
    { id: 'BOLD_SANS', label: 'Negrito', preview: '𝗡𝗲𝗴𝗿𝗶𝘁𝗼' },
    { id: 'BOLD_SERIF', label: 'Negrito (serifa)', preview: '𝐍𝐞𝐠𝐫𝐢𝐭𝐨' },
    { id: 'ITALIC_SANS', label: 'Itálico', preview: '𝘪𝘵𝘢𝘭𝘪𝚌' },
    { id: 'ITALIC_SERIF', label: 'Itálico (serifa)', preview: '𝑖𝑡𝑎𝑙𝑖𝑐' },
    { id: 'BOLD_ITALIC_SANS', label: 'Negrito itálico', preview: '𝒏𝒆𝒈𝒓𝒊𝒕𝒐' },
    {
        id: 'BOLD_ITALIC_SERIF',
        label: 'Negrito itálico (serifa)',
        preview: '𝒏𝒆𝒈𝒓𝒊𝒕𝒐',
    },
    { id: 'STRIKETHROUGH', label: 'Rasurado', preview: '𝘳̶𝘢̶𝘴̶𝘶̶' },
    { id: 'UNDERLINE', label: 'Sublinhado', preview: '𝘴̶𝘶̶𝘭̶' },
] as const;

/** Caractere de espaço (ASCII). Os estilos de marca não o tocam. */
const SPACE = ' ';

// ---------------------------------------------------------------------------
// Tabelas por deslocamento a partir da base do bloco
// ---------------------------------------------------------------------------

/**
 * Estilos de troca de letra. `upper`/`lower` são o ponto de partida em U+1D400;
 * a letra é `base + (código ASCII − 'A')` dentro da gama A-Z.
 */
const LETTER_SWAP_STYLES: Record<
    string,
    {
        upper: number;
        lower: number;
        /** Dígitos em negrito existem só em alguns blocos; null = não existem. */
        digits: number | null;
        /** Substituições fora da tabela (o `h` itálico, chiefly). */
        overrides?: Record<string, string>;
    }
> = {
    BOLD_SERIF: { upper: 0x1d400, lower: 0x1d41a, digits: 0x1d7ce },
    ITALIC_SERIF: {
        upper: 0x1d434,
        lower: 0x1d44e,
        digits: null,
        // U+1D455 (h itálico minúsculo) está reservado pela Unicode para
        // acomodar esta forma canónica: U+210E PLANCK CONSTANT, que é
        // renderizado como um 'h' em itálico math.
        overrides: { h: 'ℎ' },
    },
    BOLD_ITALIC_SERIF: { upper: 0x1d468, lower: 0x1d482, digits: null },
    BOLD_SANS: { upper: 0x1d5d4, lower: 0x1d5ee, digits: 0x1d7ec },
    ITALIC_SANS: { upper: 0x1d608, lower: 0x1d622, digits: null },
    BOLD_ITALIC_SANS: { upper: 0x1d63c, lower: 0x1d656, digits: null },
};

/** Estilos de marca combinante: acrescentam um carácter, não trocam a letra. */
const MARK_STYLES: Record<string, string> = {
    STRIKETHROUGH: '̶', // COMBINING LONG STROKE OVERLAY
    UNDERLINE: '̲', // COMBINING LOW LINE
};

/**
 * Converte um único carácter (já decomposto) para o estilo pedido.
 * Devolve-o intacto se o estilo não tiver equivalente.
 */
function swapChar(char: string, style: UnicodeStyleId): string {
    const override = LETTER_SWAP_STYLES[style]?.overrides?.[char];
    if (override) return override;

    // `for...of` e não indexação: os caracteres Unicode de estilo vivem fora do
    // BMP e são surrogate pairs. `charCodeAt` partiria os emojis ao meio.
    const [codePoint] = [...char];
    if (codePoint.length !== 1) return char;
    const cp = codePoint.codePointAt(0);
    if (cp === undefined) return char;

    const table = LETTER_SWAP_STYLES[style];
    if (!table) return char;

    if (cp >= 0x41 && cp <= 0x5a) {
        return String.fromCodePoint(table.upper + (cp - 0x41));
    }
    if (cp >= 0x61 && cp <= 0x7a) {
        return String.fromCodePoint(table.lower + (cp - 0x61));
    }
    if (table.digits !== null && cp >= 0x30 && cp <= 0x39) {
        return String.fromCodePoint(table.digits + (cp - 0x30));
    }

    // Os blocos itálico/cursiva/gótica não definem dígitos. Deixar o número
    // como está é melhor que inventar um glyph de outro bloco, que ficaria
    // desalinhado com o resto da linha.
    return char;
}

/**
 * Aplica um estilo Unicode a um texto.
 *
 * Acentos são preservados via NFD: decompõe-se, estiliza-se a base e repõe-se a
 * marca combinante. `ã` em negrito sai como `𝗮` + tilde em cima.
 *
 * @param text Texto a converter. Stilos de marca preservam os acentos sem
 *             decomposição (nunca tocam na letra).
 */
export function applyStyle(text: string, style: UnicodeStyleId): string {
    if (!text) return text;

    const mark = MARK_STYLES[style];
    if (mark) {
        // Estilos de marca: nunca pôr a barra em whitespace — U+0336 num espaço
        // desenha um traço isolado a flutuar na linha.
        let out = '';
        for (const char of text) {
            out += char;
            if (char === SPACE || char === '\n' || char === '\t') continue;
            out += mark;
        }
        return out;
    }

    if (!LETTER_SWAP_STYLES[style]) return text;

    let out = '';
    // Itera por cluster: base + marcas combinantes de cada letra acentuada.
    for (const cluster of text.normalize('NFD')) {
        out += swapChar(cluster, style);
    }
    // Recompor para NFC devolve a forma canónica que estes glyphs esperam.
    return out.normalize('NFC');
}

/** Indica se o texto já contém caracteres de um estilo Unicode. */
export function hasUnicodeStyling(text: string): boolean {
    return /[\u{1d400}-\u{1d7ff}]/u.test(text);
}
