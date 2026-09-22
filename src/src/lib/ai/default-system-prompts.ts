import type { ContentFormat, Workspace } from '@/types/database';
import { buildSystemPromptForFormat } from './content-prompts';
import { buildArticleSystemPrompt } from './prompts';

/**
 * Default em código do system prompt para um tipo de conteúdo, tal como é
 * usado em runtime pelo resolveSystemPrompt (workspace > user > default).
 * Serve para o editor de "Prompts de IA" pré-preencher os inputs com o
 * predefinido, mesmo sem override gravado na BD.
 *
 * Os builders de system só usam campos do workspace com fallback
 * (contentLanguage || 'pt', voiceTone || …), por isso `workspace` nulo/ausente
 * reproduz os defaults básicos em português.
 */
export function buildDefaultSystemPrompt(
    contentType: string,
    workspace: Workspace | null | undefined
): string {
    const ws = (workspace ?? {}) as Workspace;

    if (contentType === 'article') {
        return buildArticleSystemPrompt({ workspace: ws, topic: '' });
    }
    return buildSystemPromptForFormat(contentType as ContentFormat, {
        workspace: ws,
    });
}