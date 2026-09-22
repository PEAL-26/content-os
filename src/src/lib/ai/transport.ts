import { supabase } from '@/lib/supabase';
import type { AIProviderConfigOptions } from './types';

// =============================================================================
// Transporte das chamadas LLM — sempre via servidor próprio (same-origin):
// POST /api/ai/generate (e /api/ai/test). Em dev é o middleware do Vite;
// em prod são as Vercel Functions. O browser nunca chama os endpoints dos
// providers diretamente — é isso que resolve o CORS.
// =============================================================================

export interface CallLLMInput {
    baseUrl: string;
    apiKey: string;
    model: string;
    system?: string;
    prompt: string;
    /** Config resolvida (temperature, max_tokens). */
    config?: AIProviderConfigOptions;
    headers?: Record<string, string>;
}

interface ApiResponse {
    ok?: boolean;
    text?: string;
    error?: string;
    code?: string;
}

async function getAccessToken(): Promise<string | null> {
    try {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
    } catch {
        return null;
    }
}

async function postJson<TBody>(url: string, body: TBody): Promise<ApiResponse> {
    const token = await getAccessToken();

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });

    let payload: ApiResponse | null = null;
    try {
        payload = (await res.json()) as ApiResponse;
    } catch {
        payload = null;
    }

    if (!res.ok || !payload?.ok) {
        const message =
            payload?.error ??
            `Erro ${res.status} ao contactar o servidor de IA.`;
        throw new Error(message);
    }

    return payload;
}

/** Gera texto via servidor próprio (resolução CORS). */
export async function callLLM(input: CallLLMInput): Promise<string> {
    const payload = await postJson<CallLLMInput>('/api/ai/generate', input);
    return payload.text ?? '';
}

/** Teste de conexão por modelo (chave + modelo), via servidor próprio. */
export async function testLLM(input: {
    baseUrl: string;
    apiKey: string;
    model: string;
    headers?: Record<string, string>;
}): Promise<void> {
    await postJson('/api/ai/test', input);
}