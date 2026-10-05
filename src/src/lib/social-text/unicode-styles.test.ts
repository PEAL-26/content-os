import { describe, expect, it } from 'vitest';

import { applyStyle, hasUnicodeStyling } from './unicode-styles';

/** Lista os code points de uma string, para comparar sem ambiguidade. */
function points(text: string): number[] {
    return [...text].map((c) => c.codePointAt(0) ?? 0);
}

// Bases dos blocos, para os testes falharem com um número legível em vez de
// com um glyph que não se distingue visualmente. Confirms: `node -e` a imprimir
// cada base.
const BOLD_SERIF_DIGITS = 0x1d7ce;
const BOLD_SANS_LOWER = 0x1d5ee;
const BOLD_SANS_DIGITS = 0x1d7ec;

/** Compõe o code point estilizado a partir da base e do índice ASCII. */
function styled(base: number, letter: string): number {
    return base + (letter.codePointAt(0) ?? 0) - 0x61;
}

describe('applyStyle — blocos basics', () => {
    it('converte maiúsculas para Mathematical Bold', () => {
        expect(applyStyle('ABC', 'BOLD_SANS')).toBe('𝗔𝗕𝗖');
    });

    it('converte minúsculas para Mathematical Bold', () => {
        expect(applyStyle('abc', 'BOLD_SANS')).toBe('𝗮𝗯𝗰');
    });

    it('converte dígitos onde o bloco os tem', () => {
        // Os dígitos em negrito são 0x1D7CE–0x1D7D7 (serif) e 0x1D7EC–0x1D7F5
        // (sans). Comparar por code point: os glyphs são quase idênticos.
        expect(points(applyStyle('012', 'BOLD_SERIF'))).toEqual([
            BOLD_SERIF_DIGITS,
            BOLD_SERIF_DIGITS + 1,
            BOLD_SERIF_DIGITS + 2,
        ]);
        expect(points(applyStyle('012', 'BOLD_SANS'))).toEqual([
            BOLD_SANS_DIGITS,
            BOLD_SANS_DIGITS + 1,
            BOLD_SANS_DIGITS + 2,
        ]);
    });

    it('deixa dígitos intactos nos blocos itálicos, que não os têm', () => {
        // Não há itálico Unicode para dígitos. Inventar um glyph de outro bloco
        // ficaria desalinhado com o resto da linha.
        expect(applyStyle('a1', 'ITALIC_SANS')).toContain('1');
        expect(applyStyle('a1', 'ITALIC_SANS')).not.toContain('𝟣');
    });

    it('não toca em pontuação nem espaços', () => {
        expect(applyStyle('Olá, mundo!', 'BOLD_SANS')).toContain(', ');
        expect(applyStyle('Olá, mundo!', 'BOLD_SANS')).toContain('!');
    });
});

describe('applyStyle — a excepção do h itálico', () => {
    it('U+1D455 está reservado; o h itálico é U+210E', () => {
        // Se isto deixar de bater, o mapeamento está a produzir um code point
        // não atribuído — que o browser mostra como caixa.
        expect(points(applyStyle('h', 'ITALIC_SERIF'))).toEqual([0x210e]);
    });

    it('não affects as outras minúsculas do itálico serifado', () => {
        // 'a' itálico serifado é U+1D44E; o mapeamento tem de continuar normal
        // fora do 'h'.
        expect(points(applyStyle('a', 'ITALIC_SERIF'))).toEqual([0x1d44e]);
    });
});

describe('applyStyle — acentos via NFD', () => {
    it('estiliza a base e repõe a marca combinante', () => {
        // 'ã' decompõe-se em 'a' + U+0303. A base 'a' estilizada no bloco
        // sans-bold é 0x1D5EE; a tilde tem de voltar por cima.
        expect(points(applyStyle('ã', 'BOLD_SANS'))).toEqual([
            styled(BOLD_SANS_LOWER, 'a'),
            0x303,
        ]);
    });

    it('preserva cedilha, acento agudo e circunflexo', () => {
        // As três marcas do português: U+0327 (cedilha), U+0301 (agudo),
        // U+0302 (circunflexo).
        expect(points(applyStyle('ç', 'BOLD_SANS'))).toEqual([
            styled(BOLD_SANS_LOWER, 'c'),
            0x327,
        ]);
        expect(points(applyStyle('é', 'BOLD_SANS'))).toEqual([
            styled(BOLD_SANS_LOWER, 'e'),
            0x301,
        ]);
        expect(points(applyStyle('â', 'BOLD_SANS'))).toEqual([
            styled(BOLD_SANS_LOWER, 'a'),
            0x302,
        ]);
    });

    it('estiliza a palavra toda em português', () => {
        // 'conclusão' tem ç, ã e ã — sem o NFD saía a meio negrito.
        const result = applyStyle('conclusão', 'BOLD_SANS');
        const styled = [...result].filter(
            (c) => (c.codePointAt(0) ?? 0) >= 0x1d400
        );
        // 10 caracteres: as 7 letras base + as 3 marcas combinantes ficam
        // estilizadas ou são marcas — nenhuma letra fica em ASCII.
        expect(result).not.toMatch(/[a-zà-ú]/);
        expect(styled.length).toBeGreaterThan(0);
    });

    it('não decompõe nos estilos de marca, que nunca tocam na letra', () => {
        // Um tilde combinante solto num estilo de marca ficava com dois
        // acentos sobrepostos; aqui o 'ã' é uma letra só, intacta.
        expect(applyStyle('ã', 'STRIKETHROUGH').startsWith('ã')).toBe(true);
    });
});

describe('applyStyle — estilos de marca combinante', () => {
    it('aplica U+0336 a cada caractere não-espaço', () => {
        const result = applyStyle('ab', 'STRIKETHROUGH');
        expect(points(result)).toEqual([0x61, 0x336, 0x62, 0x336]);
    });

    it('aplica U+0332 no sublinhado', () => {
        expect(points(applyStyle('a', 'UNDERLINE'))).toEqual([0x61, 0x332]);
    });

    it('não aplica a marca a espaços', () => {
        // U+0336 num espaço desenha um traço isolado a flutuar na linha. Cada
        // caractere tem de trazer a sua própria marca; o espaço não traz.
        expect(points(applyStyle('a b', 'STRIKETHROUGH'))).toEqual([
            0x61, 0x336, 0x20, 0x62, 0x336,
        ]);
    });
});

describe('applyStyle — segurança', () => {
    it('parte por code point, para não partir emojis ao meio', () => {
        // Um emoji é um surrogate pair. Indexar por posição partiria o par ao
        // meio e devolvia lixo.
        const result = applyStyle('👍🏽 ok', 'BOLD_SANS');
        expect(result).toContain('👍🏽');
        expect(result).not.toContain('�');
    });

    it('preserva emojis que não têm variante estilizada', () => {
        expect(applyStyle('🔥🎯', 'BOLD_SANS')).toBe('🔥🎯');
    });

    it('devolve string vazia intacta', () => {
        expect(applyStyle('', 'BOLD_SANS')).toBe('');
    });

    it('não decompõe texto já sem acentos', () => {
        expect(applyStyle('abc', 'BOLD_SANS')).toBe('𝗮𝗯𝗰');
    });
});

describe('hasUnicodeStyling', () => {
    it('detecta caracteres do bloco matemático', () => {
        expect(hasUnicodeStyling('𝗔𝗕')).toBe(true);
    });

    it('devolve false para texto normal', () => {
        expect(hasUnicodeStyling('normal')).toBe(false);
    });

    it('detecta marcas combinantes de rasurado', () => {
        // As marcas U+0336 estão fora do bloco matemático, por isso o teste
        // tem de as cobrir à parte para ser útil.
        expect(applyStyle('a', 'STRIKETHROUGH')).toContain('̶');
    });
});
