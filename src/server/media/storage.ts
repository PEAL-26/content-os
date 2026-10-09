import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Storage dos ficheiros GERADOS por IA
//
// ⚠️ Vive no servidor, e não em `src/services/content-asset.service.ts`, por uma
// razão concreta: aquele módulo corre no browser e o `supabase` que ele exporta
// é criado com `storage: localStorage`, `persistSession: true` e
// `autoRefreshToken: true`. `localStorage` não existe em Node, logo importar
// esse módulo de um job Inngest rebenta antes de correr uma linha de lógica.
//
// Aqui o cliente é criado sob demanda, com o mínimo de opções e sem storage.
// =============================================================================

/** O bucket dos ficheiros gerados (separado do `assets` dos uploads). */
const GENERATED_BUCKET = 'generated';

let cached: SupabaseClient | null = null;

/**
 * Cliente Supabase para o servidor, criado uma vez por processo.
 *
 * A URL e a chave vêm do ambiente. Reutiliza o publishable key em vez de uma
 * service_role: o Storage do projecto tem as políticas públicas de leitura (é
 * como os artefactos já funcionam) e a escrita está coberta pela RLS desligada
 * que o projecto usa (`src/scripts/remove-rls.sql`).
 */
function loadSupabase(): SupabaseClient {
    if (cached) return cached;

    const url =
        process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
    const key =
        process.env.SUPABASE_PUBLISHABLE_KEY ??
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        '';

    if (!url || !key) {
        throw new Error(
            'Supabase não configurado no servidor (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY).'
        );
    }

    cached = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return cached;
}

/** Nome de ficheiro seguro + único (evita colisão e path traversal). */
function safePath(workspaceId: string, filename: string): string {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return `${workspaceId}/${unique}-${safeName}`;
}

/**
 * Guarda um ficheiro gerado e devolve o URL público.
 *
 * `upsert: false` — nunca sobrescreve. Se duas gerações para o mesmo workspace
 * acabarem no mesmo milissegundo, o sufixo aleatório evita a colisão (que com
 * `upsert: false` seria um erro, não uma perda de ficheiro).
 */
export async function uploadGeneratedFile(
    workspaceId: string,
    file: { bytes: Uint8Array; mimeType: string; filename: string }
): Promise<string> {
    const supabase = loadSupabase();
    const path = safePath(workspaceId, file.filename);

    const { error } = await supabase.storage
        .from(GENERATED_BUCKET)
        .upload(path, file.bytes, {
            contentType: file.mimeType,
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        throw new Error(`Erro ao guardar o ficheiro gerado: ${error.message}`);
    }

    const { data } = supabase.storage
        .from(GENERATED_BUCKET)
        .getPublicUrl(path);

    return data.publicUrl;
}