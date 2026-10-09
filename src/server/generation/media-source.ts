import { prisma } from '../../src/lib/prisma.js';
import { extractIllustrationMarkers } from '../../src/lib/ai/illustrations.js';
import {
    mediaSubjectsForPiece,
    type MediaPromptParams,
    type MediaSubject,
} from '../../src/lib/ai/media-prompts.js';
import { resolveRules } from '../../src/lib/platform-rules/index.js';
import type {
    ContentFormat,
    ContentScene,
    ContentSlide,
} from '../../src/types/database.js';

// =============================================================================
//FONTE dos prompts de media
//
// Um único sítio decide QUE conteúdo dá origem a QUE prompt. É o que garante
// que o "gerar artefactos" da peça e o painel de ilustrações do artigo estão a
// falar dos mesmos assuntos — e que a granularidade é a mesma nos dois.
// =============================================================================

/** Alvo de um prompt de media: artigo ou peça. */
export interface MediaTarget {
    targetType: 'ARTICLE' | 'PIECE';
    targetId: string;
}

/** Conteúdo de origem, tal como está guardado. */
export interface MediaSource {
    format: ContentFormat | null;
    channelId: string | null;
    articleId: string | null;
    workspaceId: string;
    title: string | null;
    body: string;
    slides: ContentSlide[] | null;
    scenes: ContentScene[] | null;
    /** Idioma do workspace — o áudio precisa dele. */
    language: string;
}

/**
 * Assuntos (um prompt cada) derivados do conteúdo.
 *
 * Um carrossel dá um por slide e um vídeo um por cena — é o que o formato exige
 * na prática, e o que dá ao utilizador controlo para gerar cena a cena em vez de
 * receber "uma imagem para a peça toda" que não serve.
 *
 * Num ARTIGO, os assuntos são os marcadores `[IMAGEM SUGERIDA — ...]`: a
 * descrição que o utilizador (ou a IA) escreveu é a semente do prompt.
 */
export function subjectsFor(
    target: MediaTarget,
    source: MediaSource
): MediaSubject[] {
    if (target.targetType === 'ARTICLE') {
        return extractIllustrationMarkers(source.body).markers.map((marker) => ({
            itemKey: marker.itemKey,
            label: `Ilustração ${marker.index}`,
            text: marker.description,
        }));
    }

    return mediaSubjectsForPiece(source.format ?? 'POST', {
        title: source.title,
        body: source.body,
        slides: source.slides,
        scenes: source.scenes,
    });
}

/**
 * Carrega o conteúdo que alimenta os prompts, do alvo pedido.
 *
 * Devolve `null` quando o alvo já não existe — o caller trata como "nada a
 * fazer" em vez de falhar, porque o conteúdo pode ter sido apagado entre o
 * enqueue e a execução do job.
 */
export async function loadMediaSource(
    target: MediaTarget
): Promise<MediaSource | null> {
    if (target.targetType === 'ARTICLE') {
        const article = await prisma.article.findUnique({
            where: { id: target.targetId },
        });
        if (!article) return null;
        const workspace = await prisma.workspace.findUnique({
            where: { id: article.workspaceId },
            select: { contentLanguage: true },
        });
        return {
            format: null,
            channelId: null,
            articleId: article.id,
            workspaceId: article.workspaceId,
            title: article.title,
            body: article.body,
            slides: null,
            scenes: null,
            language: workspace?.contentLanguage ?? 'pt',
        };
    }

    const piece = await prisma.contentPiece.findUnique({
        where: { id: target.targetId },
    });
    if (!piece) return null;

    const workspace = await prisma.workspace.findUnique({
        where: { id: piece.workspaceId },
        select: { contentLanguage: true },
    });

    return {
        format: piece.format,
        channelId: piece.channelId,
        articleId: piece.articleId,
        workspaceId: piece.workspaceId,
        title: piece.title,
        body: piece.body,
        slides: (piece.slides as ContentSlide[] | null) ?? null,
        scenes: (piece.scenes as ContentScene[] | null) ?? null,
        language: workspace?.contentLanguage ?? 'pt',
    };
}

/**
 * Aspecto do canal da peça — vai como PARÂMETRO à API, nunca no prompt.
 *
 * Um artigo não tem canal (é um documento, não uma publicação), por isso fica
 * no default 1:1.
 */
export async function aspectRatioForTarget(
    channelId: string | null
): Promise<string | null> {
    if (!channelId) return null;
    const channel = await prisma.channelConfig.findUnique({
        where: { id: channelId },
    });
    if (!channel) return null;
    return resolveRules({
        channel: channel.channel,
        rules: channel.rules,
    }).aspectRatio;
}

/** Contexto de conteúdo para os prompts de media (artigo/produto/pilar). */
export async function mediaPromptParamsFor(source: MediaSource): Promise<{
    article: { title: string; summary: string | null; body: string } | null;
    product: { name: string; problemSolved: string | null } | null;
    pillar: { name: string; objective: string | null } | null;
}> {
    if (!source.articleId) {
        return { article: null, product: null, pillar: null };
    }

    const article = await prisma.article.findUnique({
        where: { id: source.articleId },
        select: {
            title: true,
            summary: true,
            body: true,
            productId: true,
            pillarId: true,
        },
    });
    if (!article) return { article: null, product: null, pillar: null };

    const [product, pillar] = await Promise.all([
        article.productId
            ? prisma.product.findUnique({
                  where: { id: article.productId },
                  select: { name: true, problemSolved: true },
              })
            : null,
        article.pillarId
            ? prisma.pillarConfig.findUnique({
                  where: { id: article.pillarId },
                  select: { name: true, objective: true },
              })
            : null,
    ]);

    return {
        article: {
            title: article.title,
            summary: article.summary,
            body: article.body,
        },
        product: product
            ? { name: product.name, problemSolved: product.problemSolved }
            : null,
        pillar: pillar ? { name: pillar.name, objective: pillar.objective } : null,
    };
}

export type { MediaPromptParams };