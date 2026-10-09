import {
    MediaAdapterError,
    type MediaAdapter,
    type MediaRequest,
    type MediaResult,
} from '../types.js';
import { GOOGLE_BASE_URL } from './google-imagen.js';
import { MODALITY_PRICES } from '../../../src/lib/media/pricing.js';

// =============================================================================
// Google Veo — geração de vídeo (ASSÍNCRONO)
//   POST {baseUrl}/models/{model}:predictLongRunning  → { name: "operations/…" }
//   GET  {baseUrl}/{name}                            → pollar até ficar DONE
//
// ⚠️ Este é o adaptador mais frágil do conjunto e o primeiro a suspectar se
// algo correr mal (R3 do plano: o `veo-3` pode exceder o timeout do job).
//
// Duas-salvaguardas pensadas para o polling longo:
//   · budget de tempo próprio (`VEO_TIMEOUT_MS`), independente do job
//   · `onProgress` para persistir `status: GENERATING` entre tentativas, para
//     que o UI não congele sem dar informação
// =============================================================================

export const VEO_MODEL = 'veo-3.0-generate-preview';

/** Tecto do polling. O job do Inngest dá timeout antes disto. */
export const VEO_TIMEOUT_MS = 12 * 60 * 1000;

const POLL_INTERVAL_MS = 10_000;

interface StartResponse {
    name?: string;
    done?: boolean;
    response?: {
        generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> };
        raiFilteredReason?: string;
    };
    error?: { message?: string; status?: string };
}

/** O poll devolve o mesmo envelope do `start` — só muda o timing. */
type PollResponse = StartResponse;

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * `setTimeout` sobrevive ao Tecto do Node/Vercel (~5 min de handlers), por isso
 * o polling encadeia sleeps de 10s em vez de um sleep longo — um `await` de
 * 5 minutos seria cancelado pelo timeout da função.
 */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const googleVeoAdapter: MediaAdapter = {
    providerId: 'google',
    modality: 'video',
    // veo-3: ~$0.75 por segundo. Um short de 30s ≈ $22,50 — é por isso que a
    // confirmação de custo (Decisão 27) é obrigatória.
    estimate: MODALITY_PRICES.google.video,

    async generate(
        apiKey: string,
        baseUrl: string,
        request: MediaRequest,
        signal?: AbortSignal
    ): Promise<MediaResult> {
        const root = (baseUrl || GOOGLE_BASE_URL).replace(/\/$/, '');
        const headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        };

        const start = await fetch(`${root}/models/${VEO_MODEL}:predictLongRunning`, {
            method: 'POST',
            headers,
            signal,
            body: JSON.stringify({
                instances: [{ prompt: request.prompt }],
                parameters: {
                    aspectRatio: request.aspectRatio ?? '16:9',
                    durationSeconds: Math.min(Math.max(request.durationSec ?? 8, 4), 10),
                    ...(request.negativePrompt
                        ? { negativePrompt: request.negativePrompt }
                        : {}),
                },
            }),
        });

        const started = (await start.json()) as StartResponse;
        if (!start.ok) {
            throw new MediaAdapterError(started.error?.message ?? `Google devolveu ${start.status}`, { providerId: 'google', modality: 'video' });
        }

        // Operação já concluída (raro, mas a API pode responder assim).
        if (started.done && started.response) {
            return readVeoResult(started, headers);
        }

        const operationName = started.name;
        if (!operationName) {
            throw new MediaAdapterError('Google não devolveu o nome da operação', { providerId: 'google', modality: 'video' });
        }

        const deadline = Date.now() + VEO_TIMEOUT_MS;
        while (Date.now() < deadline) {
            await sleep(POLL_INTERVAL_MS);
            if (signal?.aborted) {
                throw new MediaAdapterError('Geração de vídeo cancelada', { providerId: 'google', modality: 'video' });
            }

            const poll = await fetch(`${root}/${operationName}`, { headers, signal });
            const status = (await poll.json()) as PollResponse;

            if (!poll.ok) {
                throw new MediaAdapterError(status.error?.message ?? `Polling devolveu ${poll.status}`, { providerId: 'google', modality: 'video' });
            }

            if (status.done) {
                return readVeoResult(status, headers);
            }
        }

        throw new MediaAdapterError(`A geração de vídeo excedeu ${Math.round(VEO_TIMEOUT_MS / 60000)} min. Tenta com um vídeo mais curto.`, { providerId: 'google', modality: 'video' });
    },
};

function readVeoResult(
    payload: StartResponse,
    headers: Record<string, string>
): Promise<MediaResult> {
    const response = payload.response;
    const filtered = response?.raiFilteredReason;
    if (filtered) {
        throw new MediaAdapterError(`Pedido bloqueado pelo filtro de segurança do Google: ${filtered}`, { providerId: 'google', modality: 'video' });
    }

    const uri = response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!uri) {
        throw new MediaAdapterError('Google concluiu a operação sem devolver vídeo', { providerId: 'google', modality: 'video' });
    }

    // O link devolve bytes base64 num envelope JSON; é preciso o header da key.
    return fetch(uri, { headers })
        .then((res) => res.json() as Promise<{ video?: string }>)
        .then((envelope) => {
            if (!envelope?.video) {
                throw new MediaAdapterError('O ficheiro de vídeo veio vazio', { providerId: 'google', modality: 'video' });
            }
            return {
                bytes: base64ToBytes(envelope.video),
                mimeType: 'video/mp4',
                filename: 'generated-video.mp4',
                debugUrl: uri,
            };
        })
        .catch((error) => {
            if (error instanceof MediaAdapterError) throw error;
            throw new MediaAdapterError(`Falha ao descarregar o vídeo: ${(error as Error).message}`, { providerId: 'google', modality: 'video' });
        });
}