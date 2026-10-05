import type { ContentFormat, Workspace } from '@/types/database';
import {
    ARTICLE_METADATA_CONTENT_TYPE,
    buildArticleMetadataSystemPrompt,
} from './article-metadata';
import { buildSystemPromptForFormat } from './content-prompts';
import { buildArticleSystemPrompt } from './prompts';
import {
    buildPromptWriterSystemPrompt,
    PROMPT_WRITER_FORMATS,
    PROMPT_WRITER_PREFIX,
} from './prompt-writer';

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

    // Metadados de artigo existente (ARTICLE_METADATA). TEM de vir antes do
    // fallthrough para `buildSystemPromptForFormat`: esse `default:` devolve o
    // prompt de post LinkedIn, e o editor de Definições de IA pré-preenchia o
    // textarea de "Metadados do artigo" com o prompt de outro formato.
    if (contentType === ARTICLE_METADATA_CONTENT_TYPE) {
        return buildArticleMetadataSystemPrompt({ workspace: ws });
    }

    // Escritor de prompts ("Gerar apenas o prompt"): `prompt_<FORMATO>`.
    if (contentType.startsWith(PROMPT_WRITER_PREFIX)) {
        const format = contentType.slice(
            PROMPT_WRITER_PREFIX.length
        ) as ContentFormat;
        if (PROMPT_WRITER_FORMATS.includes(format)) {
            return buildPromptWriterSystemPrompt(format, { workspace: ws });
        }
    }

    return buildSystemPromptForFormat(contentType as ContentFormat, {
        workspace: ws,
    });
}