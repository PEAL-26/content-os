import { supabase } from '@/lib/supabase';
import type { AIProvider } from '@/services/ai-provider.service';

const LEGACY_STORAGE_KEY = 'contentos_ai_keys';
const LEGACY_WORKSPACE_PREFIX = 'contentos_ai_keys_';

/**
 * Gestão das API keys de IA — sem password. As chaves são guardadas em claro
 * na coluna `ai_providers.apiKeyEncrypted` (o nome da coluna ficou do esquema
 * antigo; `apiKeyIv` fica a null). Ficam imediatamente acessíveis depois de
 * carregar os providers, sem necessitar de "desbloquear".
 *
 * Nota: chaves legacy que ainda tenham `apiKeyIv` (cifradas com a password
 * antiga) já não podem ser descifradas — o utilizador reintroduz a chave e ela
 * é gravada em claro.
 */
export const aiProviderKeyService = {
    isUnlocked(): boolean {
        // Sem bloqueio — as chaves estão sempre disponíveis.
        return true;
    },

    getUserId(): string | null {
        return null;
    },

    async unlock(): Promise<void> {
        // Sem password — chaves sempre acessíveis.
    },

    lock(): void {
        // Sem bloqueio — as chaves ficam sempre acessíveis.
    },

    /** Guarda a chave em claro na BD (linha `ai_providers` pelo row id). */
    async saveApiKey(providerRowId: string, key: string): Promise<void> {
        if (!key || !key.trim()) return;

        const { error } = await supabase
            .from('ai_providers')
            .update({
                apiKeyEncrypted: key.trim(),
                apiKeyIv: null,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', providerRowId);

        if (error) {
            throw new Error(`Erro ao guardar a chave: ${error.message}`);
        }
    },

    /** Apaga a chave da BD (linha `ai_providers` pelo row id). */
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

    /**
     * Devolve a chave do provider (null se ausente ou se for uma chave legacy
     * cifrada com IV — já não descifrável sem password).
     */
    async decryptApiKey(provider: AIProvider): Promise<string | null> {
        if (provider.apiKeyIv) return null;
        return provider.apiKeyEncrypted ?? null;
    },

    /**
     * Migra as chaves antigas (localStorage indexadas por providerId lógico)
     * para a BD em claro. Best-effort — corre uma vez por sessão, no primeiro
     * carregamento dos providers. Também funde as chaves legacy por workspace
     * (`contentos_ai_keys_<id>`) para o mapa global.
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

        // 2. Guarda as chaves legacy na BD (em claro).
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
            if (!key || provider.apiKeyEncrypted || provider.apiKeyIv) continue;
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