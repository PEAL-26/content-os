/**
 * Diff de modelos e headers do editor de providers — 100% puro, sem I/O e sem
 * dependências de browser.
 *
 * Vive aqui (e não no serviço) pelo mesmo motivo que `lib/ai/types.ts`: o
 * núcleo de IA tem de ser importável tanto pelo browser como pelos jobs
 * Inngest, e `@/lib/supabase` toca `localStorage` no load — o que torna o
 * serviço `ai-provider.service` impossível de importar fora do browser. Esta
 * lógica é a mesma que o `probe-provider-diff.ts` exercita.
 *
 * A chave de identidade de um modelo é o `modelCode` (o `key` nos headers):
 * é o que o resto do sistema usa para referenciar um modelo
 * (`workspaces.defaultAIModel`, `pickModel`), e o formulário garante que não
 * há duplicados dentro do mesmo provider.
 */

import { normalizeConfig } from '@/lib/ai/resolver';
import type { AIProviderConfigOptions } from '@/lib/ai/types';

export interface ModelDraftRow {
    displayName: string;
    modelCode: string;
    config?: AIProviderConfigOptions | null;
    isActive: boolean;
}

export interface HeaderDraftRow {
    key: string;
    value: string;
}

/** Subconjunto de uma linha de modelo já gravada que o diff precisa. */
export interface StoredModel {
    id: string;
    modelCode: string;
    displayName: string;
    config?: AIProviderConfigOptions | null;
    isActive: boolean;
}

export interface StoredHeader {
    id: string;
    key: string;
    value: string;
}

export interface ModelDiff {
    insert: ModelDraftRow[];
    update: {
        id: string;
        displayName: string;
        config: AIProviderConfigOptions | null;
        isActive: boolean;
    }[];
    /** Ids a apagar. */
    remove: string[];
}

export interface HeaderDiff {
    insert: HeaderDraftRow[];
    update: { id: string; value: string }[];
    remove: string[];
}

/**
 * Compara o estado gravado com o que vem do formulário e devolve **só o que
 * mudou**. Quem não mudou não entra em `update`, o que preserva `id` e
 * `createdAt` e evita escritas inúteis.
 *
 * Substitui o antigo "apaga tudo e re-insere", que tinha duas falhas: perdia
 * `id`/`createdAt` de modelos intactos, e se o `INSERT` falhasse depois do
 * `DELETE` o provider ficava sem modelos — o que fazia o `enqueue` falhar toda
 * a geração com `NO_PROVIDER`.
 */
export function diffModels(
    existing: StoredModel[],
    next: ModelDraftRow[]
): ModelDiff {
    const existingByCode = new Map(existing.map((m) => [m.modelCode, m]));
    const nextCodes = new Set(next.map((m) => m.modelCode));

    const insert: ModelDraftRow[] = [];
    const update: ModelDiff['update'] = [];

    for (const model of next) {
        const prev = existingByCode.get(model.modelCode);
        if (!prev) {
            insert.push(model);
            continue;
        }

        // A config passa por `normalizeConfig` porque devolve uma forma
        // canónica (ordem de chaves fixa, sem `null`). Sem isto, renomear um
        // provider escrevia todos os modelos só porque o JSON serializava com
        // as chaves por ordem diferente.
        const configChanged =
            JSON.stringify(normalizeConfig(prev.config)) !==
            JSON.stringify(normalizeConfig(model.config));

        if (
            prev.displayName !== model.displayName ||
            prev.isActive !== model.isActive ||
            configChanged
        ) {
            update.push({
                id: prev.id,
                displayName: model.displayName,
                // Mantém o valor guardado quando a config não mudou. Sem isto,
                // só desactivar um modelo convertia a sua `config` de `null`
                // para `{}` — semanticamente igual, mas uma alteração na linha
                // que ninguém pediu.
                config: configChanged ? (model.config ?? null) : (prev.config ?? null),
                isActive: model.isActive,
            });
        }
    }

    return {
        insert,
        update,
        remove: existing.filter((m) => !nextCodes.has(m.modelCode)).map((m) => m.id),
    };
}

/** Mesma estratégia para os headers, por `key`. */
export function diffHeaders(
    existing: StoredHeader[],
    next: HeaderDraftRow[]
): HeaderDiff {
    const existingByKey = new Map(existing.map((h) => [h.key, h]));
    const nextKeys = new Set(next.map((h) => h.key));

    const insert = next.filter((h) => !existingByKey.has(h.key));
    const update: HeaderDiff['update'] = [];

    for (const header of next) {
        const prev = existingByKey.get(header.key);
        if (prev && prev.value !== header.value) {
            update.push({ id: prev.id, value: header.value });
        }
    }

    return {
        insert,
        update,
        remove: existing.filter((h) => !nextKeys.has(h.key)).map((h) => h.id),
    };
}