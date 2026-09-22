// =============================================================================
// Cifra das API keys de IA
//
// AES-GCM-256 com chave derivada da password do utilizador (PBKDF2-SHA256,
// 100k iterações). A chave mestra vive apenas em memória (módulo) — nunca é
// persistida. O salt é guardado por utilizador em localStorage; o ciphertext e
// o IV na BD (ai_providers.apiKeyEncrypted / apiKeyIv).
// =============================================================================

const SALT_STORAGE_PREFIX = 'contentos_kek_salt_';
const PBKDF2_ITERATIONS = 100_000;

let cachedKey: CryptoKey | null = null;
let cachedUserId: string | null = null;

function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

function getSalt(userId: string): Uint8Array<ArrayBuffer> {
    const key = SALT_STORAGE_PREFIX + userId;
    const stored = localStorage.getItem(key);
    if (stored) return base64ToBytes(stored);

    const salt = randomBytes(16);
    localStorage.setItem(key, bytesToBase64(salt));
    return salt;
}

async function deriveMasterKey(
    password: string,
    salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export const keyEncryption = {
    isUnlocked(userId: string): boolean {
        return cachedUserId === userId && cachedKey !== null;
    },

    getUserId(): string | null {
        return cachedUserId;
    },

    async unlock(userId: string, password: string): Promise<void> {
        const salt = getSalt(userId);
        cachedKey = await deriveMasterKey(password, salt);
        cachedUserId = userId;
    },

    lock(): void {
        cachedKey = null;
        cachedUserId = null;
    },

    async encrypt(
        plaintext: string
    ): Promise<{ ciphertext: string; iv: string }> {
        if (!cachedKey) {
            throw new Error('Chaves de IA bloqueadas. Desbloqueia as chaves primeiro.');
        }

        const iv = randomBytes(12);
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            cachedKey,
            new TextEncoder().encode(plaintext)
        );

        return {
            ciphertext: bytesToBase64(new Uint8Array(encrypted)),
            iv: bytesToBase64(iv),
        };
    },

    async decrypt(payload: {
        ciphertext: string;
        iv: string;
    }): Promise<string | null> {
        if (!cachedKey) return null;

        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
                cachedKey,
                base64ToBytes(payload.ciphertext)
            );
            return new TextDecoder().decode(decrypted);
        } catch {
            // Chave errada (password alterada) ou dados corrompidos.
            return null;
        }
    },
};