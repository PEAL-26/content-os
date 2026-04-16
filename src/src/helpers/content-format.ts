import type { ContentFormat } from '@/types/database';

export const CONTENT_FORMAT_EMOJIS: Record<string, string> = {
    CAROUSEL: '📱',
    SHORT_VIDEO: '🎬',
    LINKEDIN_POST: '💼',
    IMAGE: '📸',
    THREAD: '🧵',
    CTA_POST: '🔗',
    VIDEO_SCRIPT: '📝',
};

export function getFormatEmoji(format: ContentFormat | string): string {
    return CONTENT_FORMAT_EMOJIS[format] || '📄';
}
