import { z } from 'zod';
import type {
    Article,
    ContentFormat,
    ContentScene,
    ContentSlide,
    MediaModality,
    Workspace,
} from '../../types/database.js';
import type { PillarConfig } from '../../types/pillar.js';
import { getFormatLabel } from '../../helpers/content-format.js';

// =============================================================================
// Prompts de MEDIA — o que vai gerar a imagem/áudio/vídeo.
//
// DISTINÇÃO CRÍTICA (a exigência que deu origem a este módulo):
//   · o prompt de conteúdo  = texto que se publica  → leva plataforma, limites
//   · o prompt de MEDIA     = descrição do ficheiro → NÃO leva nada disso
//
// O prompt de media tem de ser portátil: o utilizador tem de o poder colar no
// Midjourney, no Firefly, no CapCut e obter o mesmo resultado. Por isso aqui
// NUNCA entra nome de plataforma, formato/dimensão, hashtag nem limite de
// caracteres. O aspecto vai como PARÂMETRO à API (ver `MediaRequest`).
// =============================================================================

export interface MediaPromptParams {
    workspace: Workspace;
    article?: Pick<Article, 'title' | 'summary' | 'body'> | null;
    product?: { name: string; problemSolved?: string | null } | null;
    /** `null` e `undefined` significam a mesma coisa: sem pilar. */
    pillar?: Pick<PillarConfig, 'name' | 'objective'> | null;
}

/**
 * As regras que forceçam genericidade e autocontenção. Este é o coração da
 * Decisão 23: sem isto o modelo escreve "post para o Instagram, vertical, com
 * texto sobreposto" e o prompt deixa de servir para outro sítio.
 */
const PORTABILITY_RULES = `## Regras de portabilidade (obrigatórias)
O prompt que escreves vai ser usado noutras ferramentas, por isso:
- NÃO menciones o nome de nenhuma plataforma, rede social ou aplicação.
- NÃO menciones formato, proporção, resolução, tamanho nem número de caracteres.
- NÃO menciones hashtags, nem limites de texto, nem regras de publicação.
- Escreve APENAS a descrição visual/sonora: sujeito, ação, cenário, composição,
  enquadramento, iluminação, paleta de cores, textura, estilo e humor.
- Sê específico e concreto. "Uma sala de escritório" é fraco; "uma sala de
  escritório ao entardecer, luz dourada vinda da janela à esquerda, duas chávenas
  de café na secretária, um*ecrã com um gráfico ascendente" é aproveitável.`;

const MODALITY_SPEC: Record<MediaModality, string> = {
    image:
        'Descreve UMA imagem estática. Podes pedir composição, enquadramento, iluminação e cor. Se quiseres texto legível dentro da imagem, diz exactamente que texto e onde.',
    audio:
        'Descreve UMA locução. Indica o idioma, o tom, o ritmo, a emoção e o que é dito (ou o seu conteúdo, se preferires que o modelo escolha as palavras). Sem música, sem efeitos.',
    video:
        'Descreve UM vídeo. Indica o movimento de câmara, a ação que acontece ao longo do tempo, o que entra e sai de cena e a atmosfera. Não incluas narração.',
};

/** Prompts de sistema editáveis, por modalidade (chave em `ai_system_prompts`). */
export const MEDIA_PROMPT_CONTENT_TYPES: Record<MediaModality, string> = {
    image: 'media_image',
    audio: 'media_audio',
    video: 'media_video',
};

export const MEDIA_PROMPT_LABELS: Record<MediaModality, string> = {
    image: 'Prompt de imagem',
    audio: 'Prompt de áudio',
    video: 'Prompt de vídeo',
};

/** O que tem de aparecer na imagem para o texto dado. */
export interface MediaSubject {
    /** `main` para a peça inteira, `slide-1`/`scene-2` para um item. */
    itemKey: string;
    /** Descrição legível do conteúdo a ilustrar. */
    text: string;
    /** Etiqueta para o painel — "Slide 3", "Cena 2", "Capa do artigo". */
    label: string;
}

function languageLabel(workspace: Workspace): string {
    const language = workspace.contentLanguage || 'pt';
    return language === 'pt'
        ? 'português'
        : language === 'en'
          ? 'inglês'
          : language;
}

function buildArticleContext(params: MediaPromptParams): string {
    const { workspace, article, product, pillar } = params;
    const lines: string[] = [];
    lines.push(`## Contexto`);
    lines.push(`Idioma: ${languageLabel(workspace)}`);

    if (workspace.targetAudience) {
        lines.push(`Público-alvo: ${workspace.targetAudience}`);
    }
    if (pillar?.name) {
        lines.push(`Pilar: ${pillar.name}`);
    }
    if (product) {
        lines.push(`Produto: ${product.name}`);
        if (product.problemSolved) {
            lines.push(`Problema que resolve: ${product.problemSolved}`);
        }
    }
    if (article) {
        lines.push(``);
        lines.push(`## Artigo`);
        lines.push(`Título: ${article.title}`);
        if (article.summary) {
            lines.push(`Resumo: ${article.summary}`);
        }
    }
    return lines.join('\n');
}

const MODALITY_NOUN: Record<MediaModality, string> = {
    image: 'geradores de imagem',
    audio: 'síntese de voz',
    video: 'geradores de vídeo',
};

export function buildMediaPromptSystemPrompt(
    modality: MediaModality,
    params: SystemOnlyParams
): string {
    const language = languageLabel(params.workspace);

    return `És um diretor de arte que escreve prompts para ${MODALITY_NOUN[modality]}.

## Tarefa
Recebes um trecho de conteúdo e escreves **um prompt** para o modelo de media
corresponder. Não escreves o conteúdo — escreves a descrição do ficheiro.

${PORTABILITY_RULES}

## O que descrever
${MODALITY_SPEC[modality]}

## Formato do output
Responde APENAS com JSON válido:
\`\`\`json
{
  "prompt": "a descrição, em ${language}",
  "negativePrompt": "o que evitar (só para imagem e vídeo)"
}
\`\`\`

- "negativePrompt" é opcional. Omite-o no áudio.
- Escreve o prompt em ${language}.
- Sem texto antes, sem comentários depois.`;
}

export interface SystemOnlyParams {
    workspace: Workspace;
}

export function buildMediaPromptUserPrompt(
    modality: MediaModality,
    params: MediaPromptParams,
    subject: MediaSubject
): string {
    return `${buildArticleContext(params)}

## A descrever
Item: ${subject.label}

Conteúdo a transformar em ${modality}:
"""
${subject.text.trim()}
"""

Escreve o prompt de ${modality} que representa fielmente o conteúdo acima.`;
}

// -----------------------------------------------------------------------------
// Parsers
// -----------------------------------------------------------------------------

export const mediaPromptSchema = z.object({
    prompt: z.string().min(1),
    negativePrompt: z.string().nullish(),
});

export type ParsedMediaPrompt = z.infer<typeof mediaPromptSchema>;

/** Valores que um modelo devolve quando não escreveu nada de verdade. */
const PLACEHOLDER_LEAVES = new Set([
    'string',
    'texto',
    'text',
    'prompt',
    'descrição',
    'descricao',
    'a prompt',
    'o prompt',
    'example',
    'exemplo',
    '...',
    'none',
    'n/a',
]);

/**
 * Valores-placeholder típicos de um esqueleto de schema que o modelo copiou
 * ("prompt": "string"). Rejeitá-los evita guardar um prompt inútil como se
 * fosse válido — e o utilizador tem de conseguir confiar no que vê guardado.
 */
function isPlaceholder(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (PLACEHOLDER_LEAVES.has(normalized)) return true;
    // Esqueleto com duas ou menos palavras e sem pontuação = rótulo, não prompt.
    if (normalized.length <= 40 && !/[.,:;]/.test(normalized)) {
        const words = normalized.split(/\s+/).filter(Boolean);
        if (words.length <= 3) return true;
    }
    return false;
}

export function parseMediaPromptResponse(
    modality: MediaModality,
    text: string
): ParsedMediaPrompt | null {
    const match = text?.match(/\{[\s\S]*\}/);
    if (!match) return null;

    let raw: unknown;
    try {
        raw = JSON.parse(match[0]);
    } catch {
        return null;
    }

    const parsed = mediaPromptSchema.safeParse(raw);
    if (!parsed.success) return null;

    const prompt = parsed.data.prompt.trim();
    if (prompt.length < 8 || isPlaceholder(prompt)) return null;

    const negativeRaw = parsed.data.negativePrompt?.trim();
    const negativePrompt =
        modality === 'audio' || !negativeRaw || isPlaceholder(negativeRaw)
            ? null
            : negativeRaw;

    return { prompt, negativePrompt };
}

// -----------------------------------------------------------------------------
// Derivação das sementes: que texto alimenta cada prompt de media
// -----------------------------------------------------------------------------

/** Itens de uma peça que dão origem a um artefacto cada. */
export function mediaSubjectsForPiece(
    format: ContentFormat,
    piece: {
        title: string | null;
        body: string;
        slides: ContentSlide[] | null;
        scenes: ContentScene[] | null;
    }
): MediaSubject[] {
    // Carrossel: um artefacto por slide (são imagens independentes na prática).
    if (format === 'CAROUSEL' && piece.slides?.length) {
        return piece.slides.map((slide) => ({
            itemKey: `slide-${slide.order}`,
            label: `Slide ${slide.order}`,
            text: [slide.title, slide.body].filter(Boolean).join(' — '),
        }));
    }

    // Vídeo: um por cena, para o utilizador poder gerar cena a cena.
    if ((format === 'VIDEO' || format === 'SHORT_VIDEO') && piece.scenes?.length) {
        return piece.scenes.map((scene) => ({
            itemKey: `scene-${scene.order}`,
            label: `Cena ${scene.order} (${scene.kind})`,
            text: [scene.visual, scene.narration, scene.onScreenText]
                .filter(Boolean)
                .join(' — '),
        }));
    }

    // Texto simples: um único artefacto para a peça.
    return [
        {
            itemKey: 'main',
            label: getFormatLabel(format),
            text: [piece.title, piece.body].filter(Boolean).join(' — '),
        },
    ];
}