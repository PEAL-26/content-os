import type { ArtifactModality } from '../../src/lib/ai/model-modalities.js';
import { elevenlabsTtsAdapter } from './adapters/elevenlabs-tts.js';
import { googleImagenAdapter } from './adapters/google-imagen.js';
import { googleVeoAdapter } from './adapters/google-veo.js';
import { openaiImagesAdapter } from './adapters/openai-images.js';
import { openaiTtsAdapter } from './adapters/openai-tts.js';
import type { MediaAdapter } from './types.js';

// =============================================================================
// REGISTRY de adaptadores de media
//
// Um adaptador por (providerId, modalidade). O dispatcher escolhe aqui; a UI
// usa `availableFor` para mostrar "este provider não tem adaptador de áudio"
// em vez de o botão aparecer e falhar.
//
// ⚠️ Um provider com um adaptador TEM DE ter a modalidade declarada em
// `ai_provider_models.modalities`, senão nunca é escolhido (a lista de
// candidatos passa por `modelsForModality`).
//
// Replicate e fal não entram na 1ª entrega: o registry é aditivo, basta
// escrever o adaptador e registá-lo aqui.
// =============================================================================

const ADAPTERS: readonly MediaAdapter[] = [
    openaiImagesAdapter,
    openaiTtsAdapter,
    googleImagenAdapter,
    googleVeoAdapter,
    elevenlabsTtsAdapter,
];

/** Adaptadores de uma modalidade, na ordem de registo. */
export function adaptersFor(modality: ArtifactModality): MediaAdapter[] {
    return ADAPTERS.filter((adapter) => adapter.modality === modality);
}

/**
 * Adaptador para um par (provider, modalidade), ou `null` se o provider não
 * falar essa língua.
 */
export function findAdapter(
    providerId: string,
    modality: ArtifactModality
): MediaAdapter | null {
    return (
        ADAPTERS.find(
            (adapter) => adapter.providerId === providerId && adapter.modality === modality
        ) ?? null
    );
}

/** Este provider tem algum adaptador de media? (Para não o oferecer no selector.) */
export function providerHasAnyAdapter(providerId: string): boolean {
    return ADAPTERS.some((adapter) => adapter.providerId === providerId);
}

/** Modalidades que este provider sabe gerar. */
export function supportedModalities(providerId: string): ArtifactModality[] {
    return ADAPTERS.filter((a) => a.providerId === providerId).map((a) => a.modality);
}

/** Todos os `providerId` com adaptador — usado na detecção do catálogo. */
export function knownMediaProviderIds(): string[] {
    return [...new Set(ADAPTERS.map((adapter) => adapter.providerId))];
}

/** Descobre que modalidades um modelo declarar segundo o registry. */
export function modalitiesFromRegistry(
    providerId: string,
    modelCode: string
): ArtifactModality[] {
    const fromProvider = supportedModalities(providerId);
    const normalized = modelCode.toLowerCase();

    // Distinguir imagen/vídeo do mesmo provider Google pelo código do modelo.
    if (providerId === 'google') {
        if (normalized.startsWith('veo')) return ['video'];
        if (normalized.startsWith('imagen')) return ['image'];
    }
    return fromProvider;
}