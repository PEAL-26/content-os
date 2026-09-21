const STORAGE_PREFIX = 'contentos_ai_keys';

function getStorageKey(workspaceId: string): string {
    return `${STORAGE_PREFIX}_${workspaceId}`;
}

export const aiProviderKeyService = {
    getApiKey(workspaceId: string, providerId: string): string | null {
        try {
            const stored = localStorage.getItem(getStorageKey(workspaceId));
            if (!stored) return null;
            const keys = JSON.parse(stored) as Record<string, string>;
            return keys[providerId] ?? null;
        } catch {
            return null;
        }
    },

    setApiKey(workspaceId: string, providerId: string, key: string): void {
        try {
            const stored = localStorage.getItem(getStorageKey(workspaceId));
            const keys: Record<string, string> = stored ? JSON.parse(stored) : {};
            keys[providerId] = key;
            localStorage.setItem(getStorageKey(workspaceId), JSON.stringify(keys));
        } catch (error) {
            console.error('Erro ao guardar API key:', error);
        }
    },

    removeApiKey(workspaceId: string, providerId: string): void {
        try {
            const stored = localStorage.getItem(getStorageKey(workspaceId));
            if (!stored) return;
            const keys = JSON.parse(stored) as Record<string, string>;
            delete keys[providerId];
            localStorage.setItem(getStorageKey(workspaceId), JSON.stringify(keys));
        } catch (error) {
            console.error('Erro ao remover API key:', error);
        }
    },

    getAllApiKeys(workspaceId: string): Record<string, string> {
        try {
            const stored = localStorage.getItem(getStorageKey(workspaceId));
            if (!stored) return {};
            return JSON.parse(stored) as Record<string, string>;
        } catch {
            return {};
        }
    },

    hasApiKey(workspaceId: string, providerId: string): boolean {
        return this.getApiKey(workspaceId, providerId) !== null;
    },
};
