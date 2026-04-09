import type { ArticleStatus } from './database';

export const STATUS_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
    DRAFT: ['REVIEW'],
    REVIEW: ['APPROVED', 'DRAFT'],
    APPROVED: ['PUBLISHED', 'REVIEW'],
    PUBLISHED: ['REVIEW'],
};

export const STATUS_LABELS: Record<ArticleStatus, string> = {
    DRAFT: 'Rascunho',
    REVIEW: 'Em revisão',
    APPROVED: 'Aprovado',
    PUBLISHED: 'Publicado',
};

export const STATUS_TRANSITION_LABELS: Record<ArticleStatus, string> = {
    DRAFT: 'Enviar para revisão',
    REVIEW: 'Revisar',
    APPROVED: 'Publicar',
    PUBLISHED: 'Despublicar',
};

export function canTransitionTo(
    currentStatus: ArticleStatus,
    targetStatus: ArticleStatus
): boolean {
    return STATUS_TRANSITIONS[currentStatus].includes(targetStatus);
}

export function calculateReadingTime(body: string): number {
    const wordsPerMinute = 200;
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .substring(0, 100);
}
