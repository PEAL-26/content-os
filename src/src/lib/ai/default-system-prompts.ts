import { CONTENT_FORMAT_SET } from '@/helpers/content-format';
import { MEDIA_MODALITIES, type ContentFormat, type Workspace } from '@/types/database';
import {
    ARTICLE_METADATA_CONTENT_TYPE,
    buildArticleMetadataSystemPrompt,
} from './article-metadata';
import { buildSystemPromptForType } from './content-prompts';
import {
    buildMediaPromptSystemPrompt,
    MEDIA_PROMPT_CONTENT_TYPES,
} from './media-prompts';
import { buildArticleSystemPrompt } from './prompts';
import { buildPromptWriterSystemPrompt, PROMPT_WRITER_PREFIX } from './prompt-writer';

/** `true` se `value` é um dos 5 tipos genéricos de peça. */
function isContentFormat(value: string): value is ContentFormat {
    return CONTENT_FORMAT_SET.has(value);
}

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

    // Prompts de MEDIA (MEDIA_PROMPT): um por modalidade. Também tem de vir
    // antes do fallthrough — sem este ramo, o editor pré-preencheria "Prompt de
    // imagem" com o prompt de um POST, que é texto e não descrição visual.
    for (const modality of MEDIA_MODALITIES) {
        if (contentType === MEDIA_PROMPT_CONTENT_TYPES[modality]) {
            return buildMediaPromptSystemPrompt(modality, { workspace: ws });
        }
    }

    // Escritor de prompts ("Gerar apenas o prompt"): `prompt_<TIPO>`.
    if (contentType.startsWith(PROMPT_WRITER_PREFIX)) {
        const type = contentType.slice(PROMPT_WRITER_PREFIX.length) as ContentFormat;
        if (isContentFormat(type)) {
            return buildPromptWriterSystemPrompt(type, { workspace: ws });
        }
    }

    if (isContentFormat(contentType)) {
        return buildSystemPromptForType(contentType, { workspace: ws });
    }

    // contentType desconhecido: melhor um prompt neutro do que o de outro tipo
    // (o `default:` de `buildSystemPromptForType` devolveria o de POST).
    return buildSystemPromptForType('POST', { workspace: ws });
}