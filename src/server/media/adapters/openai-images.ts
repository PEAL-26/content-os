import {
    MediaAdapterError,
    type MediaAdapter,
    type MediaRequest,
    type MediaResult,
} from '../types.js';
import { MODALITY_PRICES } from '../../../src/lib/media/pricing.js';

// =============================================================================
// OpenAI — geração de imagem
//   POST {baseUrl}/images/generations
// Não passa pelo chat completions, por isso não dá para reutilizar o
// `transport.ts`. Resposta: `{ data: [{ b64_json | url }] }`.
// =============================================================================

/** `1024x1024` etc. A API só aceita estes tamanhos; qualquer outro é derivativo. */
const SIZE_BY_ASPECT: Record<string, string> = {
    '1:1': '1024x1024',
    '4:5': '1024x1280',
    '2:3': '1024x1536',
    '9:16': '1024x1536',
    '16:9': '1536x1024',
    '3:2': '1536x1024',
    '1.91:1': '1536x1024',
};

const DEFAULT_SIZE = '1024x1024';

function sizeFor(aspectRatio?: string | null): string {
    if (!aspectRatio) return DEFAULT_SIZE;
    return SIZE_BY_ASPECT[aspectRatio] ?? DEFAULT_SIZE;
}

interface ImagesResponse {
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
    error?: { message?: string };
}

/** Descodifica base64 para bytes sem depender do Buffer (corre em Vercel Edge). */
function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export const openaiImagesAdapter: MediaAdapter = {
    providerId: 'openai',
    modality: 'image',
    // gpt-image-1: ~$0.04 por imagem (standard).
    estimate: MODALITY_PRICES.openai.image,

    async generate(
        apiKey: string,
        baseUrl: string,
        request: MediaRequest
    ): Promise<MediaResult> {
        const url = `${baseUrl.replace(/\/$/, '')}/images/generations`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-image-1',
                prompt: request.prompt,
                size: sizeFor(request.aspectRatio),
                n: 1,
                output_format: 'png',
            }),
        });

        const payload = (await response.json()) as ImagesResponse;

        if (!response.ok) {
            throw new MediaAdapterError(payload.error?.message ?? `OpenAI devolveu ${response.status}`, { providerId: 'openai', modality: 'image' });
        }

        const first = payload.data?.[0];
        if (!first) {
            throw new MediaAdapterError('OpenAI não devolveu nenhuma imagem', { providerId: 'openai', modality: 'image' });
        }

        // `gpt-image-1` devolve sempre `b64_json`; `url` fica para modelos que
        // prefiram devolver um link.
        if (first.b64_json) {
            return {
                bytes: base64ToBytes(first.b64_json),
                mimeType: 'image/png',
                filename: 'generated-image.png',
            };
        }

        if (first.url) {
            const download = await fetch(first.url);
            if (!download.ok) {
                throw new MediaAdapterError(`Falha ao descarregar a imagem gerada (${download.status})`, { providerId: 'openai', modality: 'image' });
            }
            return {
                bytes: new Uint8Array(await download.arrayBuffer()),
                mimeType: download.headers.get('content-type') ?? 'image/png',
                filename: 'generated-image.png',
                debugUrl: first.url,
            };
        }

        throw new MediaAdapterError('OpenAI devolveu uma resposta sem imagem', { providerId: 'openai', modality: 'image' });
    },
};