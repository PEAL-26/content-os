// =============================================================================
// Geração de IA assíncrona (Inngest) — tipos partilhados server-side.
// Re-exporta os tipos puros de src/lib/ai/generation-job-types.ts (usados
// também pelo client) e acrescenta os tipos internos do servidor.
// =============================================================================

export type {
    ArticleMetadataJobParams,
    ContentItemJobParams,
    ContentPiecesJobParams,
    GenerationJob,
    GenerationJobItem,
    GenerationJobParams,
    GenerationJobStatusValue,
    GenerationJobTypeValue,
    GenerationPreferred,
    MediaArtifactJobParams,
    MediaPromptJobParams,
    MetadataField,
    NewArticleJobParams,
    TargetMode,
} from '../../src/lib/ai/generation-job-types.js';
import type { JobRow } from './job-store.js';

// O contexto vive em `context.ts` (que tem as funções de mapeamento) — este
// ficheiro só o re-exporta, para não criar dois sites a dizer a mesma coisa.
export type { LoadedGenerationContext } from './context.js';
export type { JobRow };