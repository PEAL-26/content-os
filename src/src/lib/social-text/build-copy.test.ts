import { describe, expect, it } from 'vitest';

import type { VideoScriptWithRelations } from '@/services/video-script.service';
import type { ContentPieceWithRelations } from '@/types/database';

import {
    buildBlocks,
    buildCopy,
    buildPlainCopy,
    renderHtml,
    renderPlain,
    type CopySource,
} from './build-copy';
import { PLATFORM_PRESETS } from './platforms';
import { applyStyle } from './unicode-styles';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function piece(
    over: Partial<ContentPieceWithRelations> = {}
): ContentPieceWithRelations {
    return {
        id: 'p1',
        articleId: 'a1',
        workspaceId: 'w1',
        productId: null,
        channelId: null,
        format: 'LINKEDIN_POST',
        pillar: null,
        // O `title` é interno por definição — nenhum teste deve depender dele.
        title: 'Título interno que não se publica',
        body: '',
        hookText: null,
        ctaText: null,
        hashtags: [],
        slides: null,
        slideCount: null,
        status: 'DRAFT',
        publishedAt: null,
        aiGenerated: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        ...over,
    } as ContentPieceWithRelations;
}

function script(
    over: Partial<VideoScriptWithRelations> = {}
): VideoScriptWithRelations {
    return {
        id: 'v1',
        articleId: 'a1',
        workspaceId: 'w1',
        title: 'Roteiro interno',
        hook: '',
        problem: null,
        solution: null,
        cta: '',
        fullScript: '',
        durationSec: 60,
        targetChannel: 'INSTAGRAM',
        onScreenText: [],
        bRoll: [],
        status: 'DRAFT',
        aiGenerated: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        ...over,
    } as VideoScriptWithRelations;
}

const LINKEDIN = PLATFORM_PRESETS.LINKEDIN;
const X = PLATFORM_PRESETS.X;

function plain(
    source: CopySource,
    platform = LINKEDIN,
    style: Parameters<typeof applyStyle>[1] = 'BOLD_SANS'
): string {
    return renderPlain(buildBlocks(source, platform), { style, platform });
}

// ---------------------------------------------------------------------------
// Campos estruturados → blocos
// ---------------------------------------------------------------------------

describe('buildBlocks — usa os campos que o schema já tem', () => {
    it('põe o hook e o CTA em negrito, o corpo normal', () => {
        const text = plain({
            type: 'piece',
            piece: piece({
                hookText: 'O gancho',
                body: 'O corpo do post.',
                ctaText: 'Chama à ação',
            }),
        });

        expect(text.split('\n')[0]).toBe(applyStyle('O gancho', 'BOLD_SANS'));
        expect(text).toContain('O corpo do post.');
        expect(text).toContain(applyStyle('Chama à ação', 'BOLD_SANS'));
        // O corpo não leva estilo: convertê-lo inteiro seria gritante.
        expect(text).toContain('O corpo do post.');
        expect(text).not.toContain(applyStyle('corpo', 'BOLD_SANS'));
    });

    it('não copia o title interno', () => {
        const text = plain({
            type: 'piece',
            piece: piece({ title: 'NUNCA PUBLICAR', body: 'Só isto.' }),
        });
        expect(text).not.toContain('NUNCA PUBLICAR');
    });

    it('usa o array de slides do carrossel em vez de re-parsear o body', () => {
        const text = plain({
            type: 'piece',
            piece: piece({
                format: 'CAROUSEL',
                slides: [
                    { order: 1, title: 'Primeiro', body: 'Corpo um.' },
                    { order: 2, title: 'Segundo', body: 'Corpo dois.' },
                ],
                slideCount: 2,
                body: '## Primeiro\nCorpo um.\n\n## Segundo\nCorpo dois.',
            }),
        });

        expect(text).toContain(applyStyle('Primeiro', 'BOLD_SANS'));
        expect(text).toContain(applyStyle('Segundo', 'BOLD_SANS'));
        expect(text).toContain('Corpo dois.');
        // Não pode haver `##` visível: a app não renderiza markdown.
        expect(text).not.toContain('##');
    });

    it('numera os tweets de uma thread', () => {
        const text = plain(
            {
                type: 'piece',
                piece: piece({
                    format: 'THREAD',
                    body: 'Primeiro tweet.\n\nSegundo tweet.\n\nTerceiro tweet.',
                }),
            },
            X
        );

        expect(text).toContain('1/3 Primeiro tweet.');
        expect(text).toContain('2/3 Segundo tweet.');
        expect(text).toContain('3/3 Terceiro tweet.');
    });

    it('não numera tweets fora do X', () => {
        // A numeração é convenção do X; no LinkedIn é ruído.
        const text = plain({
            type: 'piece',
            piece: piece({
                format: 'THREAD',
                body: 'Primeiro.\n\nSegundo.',
            }),
        });
        expect(text).not.toContain('1/2');
    });

    it('monta o roteiro a partir de hook/problem/solution/cta', () => {
        const text = plain({
            type: 'videoScript',
            script: script({
                hook: 'O gancho do vídeo',
                problem: 'O problema',
                solution: 'A solução',
                cta: 'Segue para mais',
                fullScript: 'O roteiro completo.',
            }),
        });

        expect(text).toContain(applyStyle('O gancho do vídeo', 'BOLD_SANS'));
        expect(text).toContain('O problema');
        expect(text).toContain('A solução');
        expect(text).toContain('O roteiro completo.');
        expect(text).toContain(applyStyle('Segue para mais', 'BOLD_SANS'));
        expect(text).not.toContain('Roteiro interno');
    });
});

// ---------------------------------------------------------------------------
// Markdown → texto simples
// ---------------------------------------------------------------------------

describe('renderPlain — markdown sai convertido, não cru', () => {
    it('converte `- item` em bullet', () => {
        const text = plain({
            type: 'piece',
            piece: piece({
                body: 'Antes.\n\n- Primeiro\n- Segundo\n\nDepois.',
            }),
        });

        expect(text).toContain('• Primeiro');
        expect(text).toContain('• Segundo');
        expect(text).not.toContain('- Primeiro');
    });

    it('converte `1. item` em lista numerada', () => {
        const text = plain({
            type: 'piece',
            piece: piece({ body: '1. Alpha\n2. Beta' }),
        });

        expect(text).toContain('1. Alpha');
        expect(text).toContain('2. Beta');
    });

    it('converte `## Título` em linha em negrito', () => {
        const text = plain({
            type: 'piece',
            piece: piece({ body: '## Contexto\n\nO texto.' }),
        });

        expect(text).toContain(applyStyle('Contexto', 'BOLD_SANS'));
        expect(text).not.toContain('##');
    });

    it('converte `**negrito**` inline', () => {
        const text = plain({
            type: 'piece',
            piece: piece({ body: 'Isto é **importante** aqui.' }),
        });

        expect(text).toContain(
            `Isto é ${applyStyle('importante', 'BOLD_SANS')} aqui.`
        );
        expect(text).not.toContain('**');
    });

    it('converte `*itálico*` inline sem confundir com o negrito', () => {
        const text = plain({
            type: 'piece',
            piece: piece({ body: 'Isto é *suave* e **forte**.' }),
        });

        expect(text).toContain(applyStyle('forte', 'BOLD_SANS'));
        // Um itálico mal interpretado transformava o resto da frase em negrito.
        expect(text).toContain('Isto é ');
    });

    it('remove separadores `---`', () => {
        const text = plain({
            type: 'piece',
            piece: piece({ body: 'Antes.\n\n---\n\nDepois.' }),
        });

        expect(text).not.toContain('---');
        expect(text).toContain('Antes.');
        expect(text).toContain('Depois.');
    });
});

// ---------------------------------------------------------------------------
// Presets de plataforma
// ---------------------------------------------------------------------------

describe('presets de plataforma', () => {
    it('insere U+2800 entre parágrafos no LinkedIn', () => {
        // Sem isto o LinkedIn come as linhas em branco e o post vira um muro.
        const text = plain({
            type: 'piece',
            piece: piece({ body: 'Primeiro parágrafo.\n\nSegundo parágrafo.' }),
        });

        expect(text).toContain('⠀');
    });

    it('não insere U+2800 no Instagram', () => {
        const text = plain(
            {
                type: 'piece',
                piece: piece({
                    body: 'Primeiro parágrafo.\n\nSegundo parágrafo.',
                }),
            },
            PLATFORM_PRESETS.INSTAGRAM
        );

        expect(text).not.toContain('⠀');
    });

    it('põe as hashtags longe do corpo no Instagram, para ficarem abaixo do "more"', () => {
        const text = plain(
            {
                type: 'piece',
                piece: piece({
                    format: 'IMAGE',
                    body: 'A legenda.',
                    hashtags: ['marketing', 'socialmedia'],
                }),
            },
            PLATFORM_PRESETS.INSTAGRAM
        );

        const lines = text.split('\n');
        const tagIndex = lines.findIndex((l) => l.includes('#marketing'));
        // `hashtagGap` do Instagram é 4, logo há 4 linhas em branco entre a
        // legenda e as hashtags (índices 1–4) e as hashtags ficam no índice 5.
        expect(tagIndex).toBe(5);
        expect(lines.slice(1, tagIndex).every((l) => l === '')).toBe(true);
    });

    it('limita as hashtags ao limite da plataforma', () => {
        const many = Array.from({ length: 10 }, (_, i) => `tag${i}`);
        const text = plain(
            { type: 'piece', piece: piece({ body: 'Texto.', hashtags: many }) },
            X
        );

        // No X só cabe uma hashtag.
        expect(text.match(/#/g)).toHaveLength(1);
    });

    it('deduplica hashtags', () => {
        const text = plain({
            type: 'piece',
            piece: piece({
                body: 'Texto.',
                hashtags: ['Marketing', 'marketing', '#marketing'],
            }),
        });

        expect(text.match(/#/g)).toHaveLength(1);
    });

    it('normaliza hashtags sem o prefixo duplicado', () => {
        const text = plain({
            type: 'piece',
            piece: piece({
                body: 'Texto.',
                hashtags: ['marketing', '#social'],
            }),
        });

        expect(text).toContain('#marketing #social');
    });

    it('devolve string vazia quando não há conteúdo', () => {
        expect(plain({ type: 'piece', piece: piece({ body: '   ' }) })).toBe(
            ''
        );
    });
});

// ---------------------------------------------------------------------------
// HTML rico
// ---------------------------------------------------------------------------

describe('renderHtml — tags reais para Notion/Docs/Gmail', () => {
    it('usa <strong> e <h2>, não glyphs Unicode', () => {
        const html = renderHtml(
            buildBlocks({
                type: 'piece',
                piece: piece({
                    hookText: 'Gancho',
                    body: 'Corpo com **destaque**.',
                }),
            })
        );

        expect(html).toContain('<h2>Gancho</h2>');
        expect(html).toContain('<strong>destaque</strong>');
        // O HTML não leva caracteres do bloco matemático.
        expect(html).not.toMatch(/[\u{1d400}-\u{1d7ff}]/u);
    });

    it('usa <ul> para listas', () => {
        const html = renderHtml(
            buildBlocks({
                type: 'piece',
                piece: piece({ body: '- Um\n- Dois' }),
            })
        );

        expect(html).toContain('<ul>');
        expect(html).toContain('<li>Um</li>');
        expect(html).toContain('<li>Dois</li>');
    });

    it('usa <ol> para listas numeradas', () => {
        const html = renderHtml(
            buildBlocks({
                type: 'piece',
                piece: piece({ body: '1. Um\n2. Dois' }),
            })
        );

        expect(html).toContain('<ol>');
    });

    it('escapa HTML que venha do conteúdo', () => {
        // O conteúdo vem de uma textarea editada pelo utilizador. Sem escape,
        // um `</p>` colado injectava tag no clipboard.
        const html = renderHtml(
            buildBlocks({
                type: 'piece',
                piece: piece({ body: 'Texto <script>alert(1)</script> aqui.' }),
            })
        );

        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
});

// ---------------------------------------------------------------------------
// Entradas de alto nível
// ---------------------------------------------------------------------------

describe('buildCopy', () => {
    it('devolve as duas variantes a partir da mesma fonte', () => {
        const result = buildCopy(
            {
                type: 'piece',
                piece: piece({ hookText: 'Gancho', body: 'Corpo.' }),
            },
            { style: 'BOLD_SANS', platform: LINKEDIN }
        );

        expect(result.text).toContain(applyStyle('Gancho', 'BOLD_SANS'));
        expect(result.html).toContain('<h2>Gancho</h2>');
    });

    it('o texto simples não leva formatação nenhuma', () => {
        // É a saída de emergência: se a conversão estragar alguma coisa, o
        // utilizador ainda tem o texto intacto e pesquisável.
        const text = buildPlainCopy({
            type: 'piece',
            piece: piece({
                hookText: 'O gancho',
                body: '**O corpo** com marcação.',
            }),
        });

        expect(text).toContain('**O corpo**');
        expect(text).not.toMatch(/[\u{1d400}-\u{1d7ff}]/u);
    });

    it('o texto simples põe o gancho antes do corpo', () => {
        // O gancho é a frase que abre o post. A ordem antiga punha-o a meio.
        const text = buildPlainCopy({
            type: 'piece',
            piece: piece({
                hookText: 'O gancho',
                body: 'O corpo.',
                ctaText: 'O CTA.',
            }),
        });

        expect(text.indexOf('O gancho')).toBeLessThan(text.indexOf('O corpo'));
        expect(text.indexOf('O corpo')).toBeLessThan(text.indexOf('O CTA'));
    });

    it('o texto simples inclui as hashtags', () => {
        const text = buildPlainCopy({
            type: 'piece',
            piece: piece({ body: 'Corpo.', hashtags: ['marketing'] }),
        });

        expect(text).toContain('#marketing');
    });
});
