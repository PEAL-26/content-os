import { supabase } from '@/lib/supabase';
import type { ArticleStatus, SocialChannel } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';
import { deleteAssetsForTarget } from '@/services/content-asset.service';
import { saveGenerationPrompts, type PortablePromptItem } from '@/services/ai-prompt.service';

/**
 * Normaliza o que está na coluna TEXT `onScreenText`/`bRoll` numa lista de
 * strings. Puro, total (nunca lança, nunca devolve `null`/`undefined`).
 *
 * Porque é preciso: a coluna é TEXT e o schema diz `String?`, mas o serviço
 * declarava `string[]`. O que lá está com efeito depende de quem escreveu e de
 * quando — são formas históricas, todas elas possíveis numa linha real:
 *
 *   - `NULL`             — linhas criadas por `enqueue.ts` (o placeholder)
 *                         nunca escreveram estas colunas.
 *   - `'["a","b"]'`      — o formato de facto: os dois escritores fazem
 *                         `JSON.stringify(lista)`.
 *   - `'[]'`             — idem, com a lista vazia.
 *   - `'"texto"'`        — duplamente codificado, quando o `JSON.stringify` foi
 *                         aplicado a uma string em vez de a uma lista.
 *   - `'a\nb'`           — texto simples com uma linha por item.
 *   - `'null'`, `''`     — lixo / placeholder.
 *   - `['a','b']`        — já normalizado (o `.insert()` antigo gravava o
 *                         array cru, que o Postgres converte em texto).
 *
 * Sem isto, `script.onScreenText.length` rebentava em `NULL` (o bug da página
 * de detalhe) e, com o texto JSON, `.length` devolvia o número de CARACTERES e
 * o `.map()` seguinte lançava porque uma string não tem `.map`.
 *
 * A forma gravada passa a ser sempre o texto JSON (ver `JSON.stringify` nas
 * escritas deste serviço): esta função é a tolerância para o que já está na BD,
 * não o caminho normal.
 */
export function toStringList(value: unknown): string[] {
    // `null`/`undefined`/chave em falta: lista vazia, nunca um crash.
    if (value === null || value === undefined) return [];

    // Já é um array (linha normalizada por outra fronteira, ou o `.insert()`
    // antigo): fica só o que é string não vazio — `null` e números de uma
    // resposta da IA caem fora.
    if (Array.isArray(value)) {
        return value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item !== '');
    }

    // Qualquer outra coisa (número, booleano, objecto) não é uma lista.
    if (typeof value !== 'string') return [];

    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null') return [];

    // Primeiro `JSON.parse`: é o formato gravado pelos dois escritores.
    try {
        const parsed: unknown = JSON.parse(trimmed);
        // Array (o caso normal) ou string (o `'"texto"'` duplamente
        // codificado, ou um JSON válido que é só texto) → recurso.
        if (Array.isArray(parsed) || typeof parsed === 'string') {
            return toStringList(parsed);
        }
        // Número/objeto/`true`: JSON válido que não é lista → cai na
        // partilha por linhas abaixo.
    } catch {
        // Texto simples (`'a\nb'`) ou lixo: idem.
    }

    // Fallback: uma linha por item, sem linhas vazias nas pontas.
    return trimmed
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
}

export interface VideoScript {
    id: string;
    articleId: string;
    workspaceId: string;
    title: string;
    hook: string;
    problem: string | null;
    solution: string | null;
    cta: string;
    fullScript: string;
    durationSec: number;
    targetChannel: SocialChannel;
    onScreenText: string[];
    bRoll: string[];
    status: ArticleStatus;
    aiGenerated: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface VideoScriptWithRelations extends VideoScript {
    article?: { id: string; title: string };
}

export interface CreateVideoScriptInput {
    articleId: string;
    workspaceId: string;
    title: string;
    hook: string;
    problem?: string | null;
    solution?: string | null;
    cta: string;
    fullScript: string;
    durationSec?: number;
    targetChannel: SocialChannel;
    onScreenText?: string[];
    bRoll?: string[];
    aiGenerated?: boolean;
    /** Prompt final portátil por item (gravado em content_generation_prompts). */
    portablePrompts?: PortablePromptItem[];
}

export interface UpdateVideoScriptInput {
    title?: string;
    hook?: string;
    problem?: string | null;
    solution?: string | null;
    cta?: string;
    fullScript?: string;
    durationSec?: number;
    targetChannel?: SocialChannel;
    onScreenText?: string[];
    bRoll?: string[];
    status?: ArticleStatus;
}

export interface VideoScriptsFilters {
    articleId?: string;
    targetChannel?: SocialChannel;
    status?: ArticleStatus;
}

/**
 * Aplica `toStringList` às duas colunas TEXT de uma linha, para o tipo
 * declarado (`string[]`) deixar de ser uma mentira. Aplicado em TODOS os
 * caminhos que devolvem um `VideoScript`, porque o `.select()` do PostgREST
 * devolve a coluna tal e qual — não há cast.
 */
function normaliseVideoScript<T extends VideoScriptWithRelations | VideoScript>(
    row: T
): T {
    return {
        ...row,
        onScreenText: toStringList(row.onScreenText),
        bRoll: toStringList(row.bRoll),
    };
}

export const videoScriptService = {
    async getVideoScripts(
        workspaceId: string,
        filters?: VideoScriptsFilters
    ): Promise<VideoScriptWithRelations[]> {
        let query = supabase
            .from('video_scripts')
            .select(
                `
                *,
                article:articles(id, title)
            `
            )
            .eq('workspaceId', workspaceId)
            .order('createdAt', { ascending: false });

        if (filters?.articleId) {
            query = query.eq('articleId', filters.articleId);
        }

        if (filters?.targetChannel) {
            query = query.eq('targetChannel', filters.targetChannel);
        }

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(
                `Erro ao buscar roteiros de vídeo: ${error.message}`
            );
        }

        return ((data || []) as VideoScriptWithRelations[]).map(
            normaliseVideoScript
        );
    },

    /**
     * Um roteiro pelo id. O workspaceId é obrigatório: o RLS está globalmente
     * desligado, logo o filtro tem de vir da query.
     */
    async getVideoScript(
        workspaceId: string,
        id: string
    ): Promise<VideoScriptWithRelations | null> {
        const { data, error } = await supabase
            .from('video_scripts')
            .select(
                `
                *,
                article:articles(id, title)
            `
            )
            .eq('workspaceId', workspaceId)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(
                `Erro ao buscar roteiro de vídeo: ${error.message}`
            );
        }

        return normaliseVideoScript(data as VideoScriptWithRelations);
    },

    async createVideoScript(
        input: CreateVideoScriptInput
    ): Promise<VideoScript> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('video_scripts')
            .insert({
                id,
                articleId: input.articleId,
                workspaceId: input.workspaceId,
                title: input.title,
                hook: input.hook,
                problem: input.problem || null,
                solution: input.solution || null,
                cta: input.cta,
                fullScript: input.fullScript,
                durationSec: input.durationSec || 60,
                targetChannel: input.targetChannel,
                // Formato da coluna (TEXT) sem ambiguidade daqui para a frente:
                // sempre texto JSON. Antes ia o array cru, que o Postgres
                // convertia como lhe apetasse.
                onScreenText: JSON.stringify(input.onScreenText ?? []),
                bRoll: JSON.stringify(input.bRoll ?? []),
                status: 'DRAFT',
                aiGenerated: input.aiGenerated || false,
                createdAt: now,
                updatedAt: now,
            })
            .select()
            .single();

        if (error) {
            throw new Error(
                `Erro ao criar roteiro de vídeo: ${error.message}`
            );
        }

        // Guarda o prompt final portátil.
        if (input.portablePrompts && input.portablePrompts.length > 0) {
            await saveGenerationPrompts({
                targetType: 'VIDEO_SCRIPT',
                targetId: (data as VideoScript).id,
                items: input.portablePrompts,
            });
        }

        return normaliseVideoScript(data as VideoScript);
    },

    async updateVideoScript(
        id: string,
        input: UpdateVideoScriptInput
    ): Promise<VideoScript> {
        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };

        if (input.title !== undefined) updateData.title = input.title;
        if (input.hook !== undefined) updateData.hook = input.hook;
        if (input.problem !== undefined) updateData.problem = input.problem;
        if (input.solution !== undefined) updateData.solution = input.solution;
        if (input.cta !== undefined) updateData.cta = input.cta;
        if (input.fullScript !== undefined) updateData.fullScript = input.fullScript;
        if (input.durationSec !== undefined) updateData.durationSec = input.durationSec;
        if (input.targetChannel !== undefined) updateData.targetChannel = input.targetChannel;
        if (input.onScreenText !== undefined)
            updateData.onScreenText = JSON.stringify(input.onScreenText ?? []);
        if (input.bRoll !== undefined)
            updateData.bRoll = JSON.stringify(input.bRoll ?? []);
        if (input.status !== undefined) updateData.status = input.status;

        const { data, error } = await supabase
            .from('video_scripts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(
                `Erro ao atualizar roteiro de vídeo: ${error.message}`
            );
        }

        return normaliseVideoScript(data as VideoScript);
    },

    async updateStatus(
        id: string,
        status: ArticleStatus
    ): Promise<VideoScript> {
        const { data, error } = await supabase
            .from('video_scripts')
            .update({
                status,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Erro ao atualizar status: ${error.message}`);
        }

        return normaliseVideoScript(data as VideoScript);
    },

    /**
     * Apaga o roteiro e os seus artefactos.
     *
     * O DELETE devolve a linha removida para termos o workspaceId: sem ele não
     * dá para apagar os artefactos, porque content_assets não tem FK.
     * A limpeza só corre depois do roteiro cair — se o DELETE falhar os
     * artefactos têm de continuar a existir.
     */
    async deleteVideoScript(id: string): Promise<void> {
        const { data, error } = await supabase
            .from('video_scripts')
            .delete()
            .eq('id', id)
            .select('workspaceId');

        if (error) {
            throw new Error(
                `Erro ao eliminar roteiro de vídeo: ${error.message}`
            );
        }

        const workspaceId = data?.[0]?.workspaceId;
        if (workspaceId) {
            await deleteAssetsForTarget(workspaceId, 'VIDEO_SCRIPT', id);
        }
    },
};
