const STORAGE_KEY = 'contentos_ai_keys';
const LEGACY_PREFIX = 'contentos_ai_keys_';

function readAll(): Record<string, string> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? (JSON.parse(stored) as Record<string, string>) : {};
    } catch {
        return {};
    }
}

function writeAll(keys: Record<string, string>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch (error) {
        console.error('Erro ao guardar API keys:', error);
    }
}

/**
 * Migra as chaves antigas guardadas por workspace (contentos_ai_keys_<id>)
 * para o armazenamento global único. Best-effort — só corre uma vez.
 */
function migrateLegacyKeys(): void {
    try {
        const keys = readAll();
        const hasLegacy = Object.keys(keys).length === 0;

        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(LEGACY_PREFIX) || key === STORAGE_KEY) {
                continue;
            }
            if (hasLegacy) {
                try {
                    const parsed = JSON.parse(
                        localStorage.getItem(key) ?? '{}'
                    ) as Record<string, string>;
                    Object.assign(keys, parsed);
                } catch {
                    // ignora entradas corrompidas
                }
            }
            localStorage.removeItem(key);
        }

        if (hasLegacy) {
            writeAll(keys);
        }
    } catch {
        // best-effort
    }
}

export const aiProviderKeyService = {
    getApiKey(providerId: string): string | null {
        migrateLegacyKeys();
        const keys = readAll();
        return keys[providerId] ?? null;
    },

    setApiKey(providerId: string, key: string): void {
        const keys = readAll();
        keys[providerId] = key;
        writeAll(keys);
    },

    removeApiKey(providerId: string): void {
        const keys = readAll();
        delete keys[providerId];
        writeAll(keys);
    },

    getAllApiKeys(): Record<string, string> {
        migrateLegacyKeys();
        return readAll();
    },
};