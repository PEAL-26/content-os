// =============================================================================
// Geração de IA assíncrona (Inngest) — tipos partilhados server-side.
// Re-exporta os tipos puros de src/lib/ai/generation-job-types.ts (usados
// também pelo client) e acrescenta os tipos internos do servidor.
// =============================================================================

export type {
    ContentItemJobParams,
    ContentPiecesJobParams,
    GenerationJob,
    GenerationJobItem,
    GenerationJobParams,
    GenerationJobStatusValue,
    GenerationJobTypeValue,
    GenerationPreferred,
    NewArticleJobParams,
    TargetMode,
    VideoScriptJobParams,
} from '../../src/lib/ai/generation-job-types.js';
import type { GenerationPreferred } from '../../src/lib/ai/generation-job-types.js';

/** Params já normalizados para a execução (cargas resolvidas da BD). */
export interface LoadedGenerationContext {
    workspaceId: string;
    userId?: string | null;
    /** Default do workspace (row id + model code) para `preferred`. */
    defaultPreferred: GenerationPreferred;
}