import { supabase } from '@/lib/supabase';
import { keyEncryption } from '@/lib/crypto/key-encryption';
import type { AIProvider } from '@/services/ai-provider.service';

const LEGACY_STORAGE_KEY = 'contentos_ai_keys';
const LEGACY_WORKSPACE_PREFIX = 'contentos_ai_keys_';

/**
 * Gestão das API keys de IA. As chaves são cifradas (AES-GCM) com a chave
 * derivada da password do utilizador e persistidas em `ai_providers`
 * (`apiKeyEncrypted` + `apiKeyIv`). Em memória, o store mantém o mapa
 * `Record<providerId, key>` descifrado — as chaves em claro nunca são
 * persistidas no browser.
 */
export const aiProviderKeyService = {
    isUnlocked(userId: string): boolean {
        return keyEncryption.isUnlocked(userId);
    },

    getUserId(): string | null {
        return keyEncryption.getUserId();
    },

    /** Deriva a chave mestra a partir da password do utilizador. */
    async unlock(userId: string, password: string): Promise<void> {
        await keyEncryption.unlock(userId, password);
    },

    lock(): void {
        keyEncryption.lock();
    },

    /**
     * Cifra e persiste uma chave na BD (linha `ai_providers` pelo row id).
     * Requer chave mestra desbloqueada. Se a linha já tiver uma chave cifrada,
     * garante que a chave mestra atual a consegue descifrar antes de a
     * substituir — caso contrário recusa a operação para não perder a chave
     * antiga ao sobreescrever com uma chave derivada de password errada.
     */
    async saveApiKey(providerRowId: string, key: string): Promise<void> {
        if (!key || !key.trim()) return;

        const { data: existing, error: fetchError } = await supabase
            .from('ai_providers')
            .select('apiKeyEncrypted, apiKeyIv')
            .eq('id', providerRowId)
            .single();

        if (fetchError) {
            throw new Error(`Erro ao guardar a chave: ${fetchError.message}`);
        }

        if (existing?.apiKeyEncrypted && existing?.apiKeyIv) {
            const current = await this.decryptApiKey(
                existing as unknown as AIProvider
            );
            if (!current) {
                throw new Error(
                    'Não foi possível guardar a nova chave: a chave existente não pode ser descifrada com esta password. Desbloqueia as chaves com a password correta primeiro.'
                );
            }
        }

        const { ciphertext, iv } = await keyEncryption.encrypt(key);

        const { error } = await supabase
            .from('ai_providers')
            .update({
                apiKeyEncrypted: ciphertext,
                apiKeyIv: iv,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', providerRowId);

        if (error) {
            throw new Error(`Erro ao guardar a chave: ${error.message}`);
        }
    },

    /** Apaga a chave cifrada da BD (linha `ai_providers` pelo row id). */
    async removeApiKey(providerRowId: string): Promise<void> {
        const { error } = await supabase
            .from('ai_providers')
            .update({
                apiKeyEncrypted: null,
                apiKeyIv: null,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', providerRowId);

        if (error) {
            throw new Error(`Erro ao eliminar a chave: ${error.message}`);
        }
    },

    /** Descifra a chave de um provider (null se bloqueada/errada/ausente). */
    async decryptApiKey(provider: AIProvider): Promise<string | null> {
        if (!provider.apiKeyEncrypted || !provider.apiKeyIv) return null;
        return keyEncryption.decrypt({
            ciphertext: provider.apiKeyEncrypted,
            iv: provider.apiKeyIv,
        });
    },

    /**
     * Migra as chaves antigas (localStorage indexadas por providerId lógico)
     * para a BD cifrada. Best-effort — corre no primeiro desbloqueio.
     * Também funde as chaves legacy por workspace (`contentos_ai_keys_<id>`)
     * para o mapa global, como a migração anterior fazia.
     */
    async migrateLegacyKeys(providers: AIProvider[]): Promise<void> {
        if (providers.length === 0) return;

        // 1. Funde chaves antigas por workspace no mapa global (best-effort).
        try {
            const globalRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
            const globalKeys: Record<string, string> = globalRaw
                ? (JSON.parse(globalRaw) as Record<string, string>)
                : {};

            if (Object.keys(globalKeys).length === 0) {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const storageKey = localStorage.key(i);
                    if (
                        !storageKey ||
                        !storageKey.startsWith(LEGACY_WORKSPACE_PREFIX) ||
                        storageKey === LEGACY_STORAGE_KEY
                    ) {
                        continue;
                    }
                    try {
                        const parsed = JSON.parse(
                            localStorage.getItem(storageKey) ?? '{}'
                        ) as Record<string, string>;
                        Object.assign(globalKeys, parsed);
                    } catch {
                        // ignora entradas corrompidas
                    }
                    localStorage.removeItem(storageKey);
                }
                if (Object.keys(globalKeys).length > 0) {
                    localStorage.setItem(
                        LEGACY_STORAGE_KEY,
                        JSON.stringify(globalKeys)
                    );
                }
            }
        } catch {
            // best-effort
        }

        // 2. Cifra as chaves legacy para a BD.
        let legacy: Record<string, string> = {};
        try {
            const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
            legacy = stored
                ? (JSON.parse(stored) as Record<string, string>)
                : {};
        } catch {
            return;
        }

        const keys = Object.entries(legacy);
        if (keys.length === 0) return;

        for (const provider of providers) {
            const key = legacy[provider.providerId];
            if (!key || provider.apiKeyEncrypted) continue;
            try {
                await this.saveApiKey(provider.id, key);
            } catch (err) {
                console.warn(
                    `Migração da chave de ${provider.name} falhou:`,
                    err instanceof Error ? err.message : err
                );
            }
        }

        try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
            // best-effort
        }
    },
};