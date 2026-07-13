
/**
 * TekTrakker Sensitive Data Encryption Layer
 * Uses Native Web Crypto API (AES-GCM)
 */

const PLATFORM_SALT = "tt_enc_v1_092025";

/**
 * Derives a cryptographic key from an Organization ID and Platform Salt.
 * This ensures tenant isolation for encrypted data.
 */
async function getEncryptionKey(orgId: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(orgId + PLATFORM_SALT),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode(PLATFORM_SALT),
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts data using AES-GCM.
 * Returns a base64 encoded string containing the IV and the Ciphertext.
 */
export async function encryptSensitiveData(data: string | number, orgId: string): Promise<string> {
    if (!data && data !== 0) return "";
    const strData = String(data);
    const key = await getEncryptionKey(orgId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(strData)
    );

    // Combine IV and Encrypted data for storage
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a base64 string back into its original form.
 */
export async function decryptSensitiveData(encryptedBase64: string, orgId: string): Promise<string> {
    if (!encryptedBase64 || !encryptedBase64.includes('==') && encryptedBase64.length < 20) return encryptedBase64;
    
    try {
        const key = await getEncryptionKey(orgId);
        const combined = new Uint8Array(
            atob(encryptedBase64)
                .split("")
                .map((c) => c.charCodeAt(0))
        );

        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(decrypted);
    } catch (error) {
        console.warn("Decryption failed. Data might be plain text or key mismatch.");
        return encryptedBase64; // Fallback to raw value
    }
}
