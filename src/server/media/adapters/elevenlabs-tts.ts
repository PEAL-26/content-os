import {
    MediaAdapterError,
    type MediaAdapter,
    type MediaRequest,
    type MediaResult,
} from '../types.js';
import { MODALITY_PRICES } from '../../../src/lib/media/pricing.js';

// =============================================================================
// ElevenLabs — síntese de voz
//   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
//
// Não é OpenAI-compatible: a chave vai em `xi-api-key` e a resposta são bytes
// de áudio directo (não JSON). O `modelId` é obrigatório.
//
// A voz é escolhida pela língua: o modelo de media diz o tom, a voz é nossa.
// =============================================================================

export const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * Vozes multilingues por `modelId`. A escolha é por língua do workspace, não
 * pelo prompt — o prompt descreve a entrega, não o timbre.
 */
const VOICE_BY_LANGUAGE: Record<string, { modelId: string; voiceId: string }> = {
    pt: { modelId: 'eleven_multilingual_v2', voiceId: 'pNInz6obpgDQGcFmaJgB' },
    en: { modelId: 'eleven_multilingual_v2', voiceId: 'VR6AewLTigWG4xSOukaG' },
    es: { modelId: 'eleven_multilingual_v2', voiceId: 'yoZ06aMxZJJ28mfd3POQ' },
    fr: { modelId: 'eleven_multilingual_v2', voiceId: 'ThT5KcBeYPX3keUQqHPh' },
};

const DEFAULT_VOICE = VOICE_BY_LANGUAGE.pt;

interface ElevenError {
    detail?: string | { message?: string };
}

function readError(payload: unknown): string {
    const detail = (payload as ElevenError)?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && detail.message) return detail.message;
    return 'resposta inesperada';
}

function textToSpeak(request: MediaRequest): string {
    const explicit = request.text?.trim();
    if (explicit) return explicit;
    return request.prompt.trim();
}

export const elevenlabsTtsAdapter: MediaAdapter = {
    providerId: 'elevenlabs',
    modality: 'audio',
    // eleven_multilingual_v2: ~$0.30 por 1M caracteres.
    estimate: MODALITY_PRICES.elevenlabs.audio,

    async generate(
        apiKey: string,
        baseUrl: string,
        request: MediaRequest,
        signal?: AbortSignal
    ): Promise<MediaResult> {
        const root = (baseUrl || ELEVENLABS_BASE_URL).replace(/\/$/, '');
        const language = (request.language ?? 'pt').slice(0, 2).toLowerCase();
        const voice = VOICE_BY_LANGUAGE[language] ?? DEFAULT_VOICE;

        const response = await fetch(`${root}/text-to-speech/${voice.voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg',
                'xi-api-key': apiKey,
            },
            signal,
            body: JSON.stringify({
                text: textToSpeak(request),
                model_id: voice.modelId,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
        });

        if (!response.ok) {
            let message = `ElevenLabs devolveu ${response.status}`;
            try {
                message = `${message}: ${readError(await response.json())}`;
            } catch {
                // corpo não-JSON: fica a mensagem com o status
            }
            throw new MediaAdapterError(message, { providerId: 'elevenlabs', modality: 'audio' });
        }

        const contentType = response.headers.get('content-type') ?? 'audio/mpeg';
        const extension = contentType.includes('wav') ? 'wav' : 'mp3';

        return {
            bytes: new Uint8Array(await response.arrayBuffer()),
            mimeType: contentType,
            filename: `generated-audio.${extension}`,
        };
    },
};