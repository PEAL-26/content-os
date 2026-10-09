import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ARTIFACT_MODALITIES,
    type ArtifactModality,
} from '@/lib/ai/model-modalities';
import {
    estimateCostUsd,
    formatCostUsd,
    HIGH_COST_USD,
    priceFor,
} from '@/lib/media/pricing';
import {
    resolveAllMediaModels,
    type ArtifactModelMapping,
    type MediaCandidate,
    type MediaResolution,
} from '@/lib/media/resolution';
import { aiProviderService } from '@/services/ai-provider.service';
import { useWorkspaceStore } from '@/stores/workspace-store';

// =============================================================================
// CAPACIDADES DE MEDIA do utilizador.
//
// Responde, para cada modalidade: há modelo? qual? quanto custa?
//
// Usa EXACTAMENTE o `resolveAllMediaModels` e o `estimateCostUsd` que o servidor
// usam para gerar — a UI não tem cópia própria, senão o preço mostrado e o
// preço cobrado divergiam na primeira alteração a um adaptador.
// =============================================================================

export interface MediaCapability {
    modality: ArtifactModality;
    /** Modelo escolhido, ou `null` se nenhum activo produz a modalidade. */
    modelCode: string | null;
    providerTechnicalId: string | null;
    /** Porquê não há modelo — a UI mostra-o em vez de um erro genérico. */
    reason: string | null;
    /** USD por artefacto, ou `null` se não há modelo ou não se sabe o preço. */
    unitUsd: number | null;
    /** `unitUsd` já formatado, pronto para a confirmação. */
    unitLabel: string;
    /** A partir de `$5` a confirmação avisa explicitamente. */
    highCost: boolean;
}

/** Um modelo que pode ser escolhido para gerar uma modalidade. */
export interface MediaModelOption {
    modelCode: string;
    label: string;
    providerTechnicalId: string;
}

export interface MediaCapabilities {
    capabilities: Record<ArtifactModality, MediaCapability>;
    /** Modelos disponíveis por modalidade, para o selector de mapeamento. */
    optionsByModality: Record<ArtifactModality, MediaModelOption[]>;
    isLoading: boolean;
    /** `null` = automático; caso contrário, os modelos fixos do workspace. */
    mapping: ArtifactModelMapping | null;
    setMapping: (mapping: ArtifactModelMapping | null) => Promise<void>;
    reload: () => void;
}

type LoadedProviders = Awaited<
    ReturnType<typeof aiProviderService.getProviders>
>;

/**
 * Os candidatos que o servidor construiria, a partir dos providers visíveis.
 *
 * Espelha `resolveArtifactModel` (server/generation/media-jobs.ts): provider
 * activo, o **primeiro** modelo activo, e as modalidades declaradas nesse
 * modelo. A chave da API nunca chega aqui — ao browser não vão segredos.
 */
export function toMediaCandidates(
    providers: LoadedProviders
): MediaCandidate[] {
    return providers
        .filter((provider) => provider.isActive)
        .map((provider) => {
            const model = provider.models?.find((m) => m.isActive);
            return {
                providerId: provider.id,
                providerTechnicalId: provider.providerId,
                modelCode: model?.modelCode ?? '',
                modalities: model?.modalities ?? [],
                isActive: Boolean(model),
                priority: provider.priority,
            };
        });
}

/** Preço de uma modalidade, com o modelo que a resolução escolheu. */
function capabilityFrom(
    modality: ArtifactModality,
    resolution: MediaResolution
): MediaCapability {
    const candidate = resolution.candidate;
    // O preço vem da tabela partilhada e só existe se houver adaptador — sem
    // adaptador não há como gerar, mesmo com modelo declarado.
    const price = candidate
        ? priceFor(candidate.providerTechnicalId, modality)
        : null;
    // Prompt vazio: só interessa o preço por imagem / por segundo. O TTS é
    // proporcional aos caracteres e por isso sai `null` na preview — o valor
    // real aparece na confirmação, já com o prompt completo.
    const unitUsd = price
        ? estimateCostUsd(price, { prompt: '', durationSec: null })
        : null;

    return {
        modality,
        modelCode: candidate?.modelCode ?? null,
        providerTechnicalId: candidate?.providerTechnicalId ?? null,
        reason: candidate
            ? price
                ? null
                : `O provider ${candidate.providerTechnicalId} não tem adaptador de ${modality}.`
            : resolution.reason,
        unitUsd,
        unitLabel: formatCostUsd(unitUsd),
        highCost: unitUsd !== null && unitUsd >= HIGH_COST_USD,
    };
}

export function useMediaCapabilities(workspaceId: string): MediaCapabilities {
    const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
    const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
    const [providers, setProviders] = useState<LoadedProviders>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);

    // O mapeamento vive no workspace já carregado no store — não vale a pena
    // refazer a lista de workspaces só para o ler.
    const mapping: ArtifactModelMapping | null =
        currentWorkspace?.artifactModels ?? null;

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!workspaceId) {
                if (!cancelled) setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const loaded = await aiProviderService.getProviders();
                if (!cancelled) setProviders(loaded);
            } catch {
                // Sem providers legíveis, as capacidades ficam todas "sem
                // modelo" — que é a verdade, e não um estado de erro.
                if (!cancelled) setProviders([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [workspaceId, reloadKey]);

    const setMapping = useCallback(
        async (next: ArtifactModelMapping | null) => {
            await updateWorkspace(workspaceId, { artifactModels: next });
        },
        [updateWorkspace, workspaceId]
    );

    const capabilities = useMemo(() => {
        const resolutions = resolveAllMediaModels(
            toMediaCandidates(providers),
            mapping
        );

        const out = {} as Record<ArtifactModality, MediaCapability>;
        for (const [modality, resolution] of Object.entries(resolutions) as [
            ArtifactModality,
            MediaResolution,
        ][]) {
            out[modality] = capabilityFrom(modality, resolution);
        }
        return out;
    }, [providers, mapping]);

    /**
     * Todas as opções por modalidade, não só a escolhida.
     *
     * Um provider activo pode ter dois modelos de imagem (um barato, um
     * top); o selector tem de oferecer os dois. Um modelo só entra se
     * declarar a modalidade — é isso que o torna candidato.
     *
     * A ordenação é a mesma do modo automático (`priority` do provider,
     * menor primeiro), por isso a lista aparece na ordem em que seria
     * escolhida sem mapeamento explícito.
     */
    const optionsByModality = useMemo(() => {
        // Os providers por `priority`, uma vez só.
        const byPriority = [...providers]
            .filter((provider) => provider.isActive)
            .sort((a, b) => a.priority - b.priority);

        const out = {} as Record<ArtifactModality, MediaModelOption[]>;
        for (const modality of ARTIFACT_MODALITIES) {
            out[modality] = byPriority.flatMap((provider) =>
                (provider.models ?? [])
                    .filter(
                        (model) =>
                            model.isActive &&
                            model.modalities?.includes(modality)
                    )
                    .map((model) => ({
                        modelCode: model.modelCode,
                        label: `${model.displayName || model.modelCode} (${provider.name})`,
                        providerTechnicalId: provider.providerId,
                    }))
            );
        }
        return out;
    }, [providers]);

    return {
        capabilities,
        optionsByModality,
        isLoading,
        mapping,
        setMapping,
        reload: () => setReloadKey((k) => k + 1),
    };
}