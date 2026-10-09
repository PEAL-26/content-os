import {
    MediaAdapterError,
    type MediaAdapter,
    type MediaRequest,
    type MediaResult,
} from '../types.js';
import { MODALITY_PRICES } from '../../../src/lib/media/pricing.js';

// =============================================================================
// Google Imagen — geração de imagem
//   POST {baseUrl}/models/{model}:predict
//
// A base do Gemini é `https://generativelanguage.googleapis.com/v1beta/` e a
// chave vai em `x-goog-api-key` (não em `Authorization: Bearer`). A resposta vem
// em `predictions[0].bytesBase64Encoded`.
// =============================================================================

export const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** Modelos por ordem de preferência — o dispatcher escolhe pelo `modelCode`. */
export const GOOGLE_IMAGE_MODELS = [
    'imagen-3.0-generate-002',
    'imagen-3.0-fast-generate-001',
] as const;

interface PredictResponse {
    predictions?: Array<{
        bytesBase64Encoded?: string;
        mimeType?: string;
        raiFilteredReason?: string;
    }>;
    error?: { message?: string; status?: string };
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/** O Imagen só aceita `aspectRatio` numa lista cerrada. */
const SUPPORTED_ASPECTS = ['1:1', '3:4', '4:3', '9:16', '16:9'];

function aspectFor(aspectRatio?: string | null): string {
    if (aspectRatio && SUPPORTED_ASPECTS.includes(aspectRatio)) return aspectRatio;
    return '1:1';
}

export const googleImagenAdapter: MediaAdapter = {
    providerId: 'google',
    modality: 'image',
    // imagen-3: ~$0.03 por imagem.
    estimate: MODALITY_PRICES.google.image,

    async generate(
        apiKey: string,
        baseUrl: string,
        request: MediaRequest,
        signal?: AbortSignal
    ): Promise<MediaResult> {
        const root = (baseUrl || GOOGLE_BASE_URL).replace(/\/$/, '');
        const url = `${root}/models/${GOOGLE_IMAGE_MODELS[0]}:predict`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            signal,
            body: JSON.stringify({
                instances: [{ prompt: request.prompt }],
                parameters: {
                    sampleCount: 1,
                    aspectRatio: aspectFor(request.aspectRatio),
                    ...(request.negativePrompt
                        ? { negativePrompt: request.negativePrompt }
                        : {}),
                },
            }),
        });

        const payload = (await response.json()) as PredictResponse;

        if (!response.ok) {
            throw new MediaAdapterError(payload.error?.message ?? `Google devolveu ${response.status}`, { providerId: 'google', modality: 'image' });
        }

        const prediction = payload.predictions?.[0];
        if (!prediction?.bytesBase64Encoded) {
            const filtered = prediction?.raiFilteredReason;
            throw new MediaAdapterError(
                filtered
                    ? `Pedido bloqueado pelo filtro de segurança do Google: ${filtered}`
                    : 'Google não devolveu imagem',
            { providerId: 'google', modality: 'image' }
            );
        }

        return {
            bytes: base64ToBytes(prediction.bytesBase64Encoded),
            mimeType: prediction.mimeType ?? 'image/png',
            filename: 'generated-image.png',
        };
    },
};
