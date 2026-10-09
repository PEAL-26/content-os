import {
    MediaAdapterError,
    type MediaAdapter,
    type MediaRequest,
    type MediaResult,
} from '../types.js';
import { MODALITY_PRICES } from '../../../src/lib/media/pricing.js';

// =============================================================================
// OpenAI — síntese de voz
//   POST {baseUrl}/chat/completions com `modalities: ['audio']`
//
// Este é o ÚNICO adaptador de media que passa pelo chat completions — a API da
// OpenAI não tem `/audio/speech`. A resposta traz `choices[0].message.audio.data`
// em base64.
// =============================================================================

/** Vozes disponíveis em `gpt-4o-mini-tts` no momento da escrita. */
export const OPENAI_TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;

export type OpenAiTtsVoice = (typeof OPENAI_TTS_VOICES)[number];

const VOICE_BY_LANGUAGE: Record<string, OpenAiTtsVoice> = {
    pt: 'onyx',
    en: 'alloy',
    es: 'nova',
    fr: 'shimmer',
};

function voiceFor(language?: string | null): OpenAiTtsVoice {
    const base = (language ?? 'pt').slice(0, 2).toLowerCase();
    return VOICE_BY_LANGUAGE[base] ?? 'alloy';
}

interface ChatResponse {
    choices?: Array<{
        message?: {
            audio?: { data?: string; format?: string };
        };
        finish_reason?: string;
    }>;
    error?: { message?: string };
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Quando o prompt descreve a locução ("tom caloroso, ritmo lento") e não diz
 * o que ler, mandamos o prompt como texto a ser lido — é o comportamento que
 * o utilizador espera ao carregar em "Gerar áudio" numa peça.
 */
function textToSpeak(request: MediaRequest): string {
    const explicit = request.text?.trim();
    if (explicit) return explicit;
    return request.prompt.trim();
}

export const openaiTtsAdapter: MediaAdapter = {
    providerId: 'openai',
    modality: 'audio',
    // gpt-4o-mini-tts: ~$0.60 por 1M tokens ⇒ ~$15 por 1M caracteres.
    estimate: MODALITY_PRICES.openai.audio,

    async generate(
        apiKey: string,
        baseUrl: string,
        request: MediaRequest
    ): Promise<MediaResult> {
        const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-tts',
                modalities: ['text', 'audio'],
                audio: { voice: voiceFor(request.language), format: 'wav' },
                messages: [
                    {
                        role: 'user',
                        content: textToSpeak(request),
                    },
                ],
            }),
        });

        const payload = (await response.json()) as ChatResponse;

        if (!response.ok) {
            throw new MediaAdapterError(payload.error?.message ?? `OpenAI devolveu ${response.status}`, { providerId: 'openai', modality: 'audio' });
        }

        const base64 = payload.choices?.[0]?.message?.audio?.data;
        if (!base64) {
            throw new MediaAdapterError('OpenAI não devolveu áudio', { providerId: 'openai', modality: 'audio' });
        }

        return {
            bytes: base64ToBytes(base64),
            mimeType: 'audio/wav',
            filename: 'generated-audio.wav',
        };
    },
};