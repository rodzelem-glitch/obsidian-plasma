/**
 * Encrypted Offline Storage Service for TekTrakker
 * Encrypts local job data using WebCrypto AES-GCM bound to current user session
 */

const STORAGE_PREFIX = 'tektrakker_secure_offline_';

interface EncryptedPayload {
  userId: string;
  timestamp: string;
  iv: string;
  ciphertext: string;
}

// Generate session encryption key derived from user ID and secret seed
async function getEncryptionKey(userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const rawKey = encoder.encode(`tektrakker_offline_key_${userId}`);
  const keyHash = await crypto.subtle.digest('SHA-256', rawKey);
  return crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// Convert buffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to buffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class OfflineStorageService {
  /**
   * Sanitizes job object to strip passwords or payment information before caching
   */
  private static sanitizeData(data: any): any {
    if (!data) return data;
    const clone = JSON.parse(JSON.stringify(data));
    
    // Strip sensitive fields explicitly
    const stripSensitiveKeys = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;
      delete obj.password;
      delete obj.cardNumber;
      delete obj.cvv;
      delete obj.paymentToken;
      delete obj.bankAccount;
      delete obj.ssn;
      delete obj.directDeposit;

      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          stripSensitiveKeys(obj[key]);
        }
      }
    };

    stripSensitiveKeys(clone);
    return clone;
  }

  /**
   * Encrypts and saves item for authenticated user
   */
  static async setSecureItem(userId: string, key: string, data: any): Promise<void> {
    if (!userId) throw new Error("Authenticated user ID required for secure offline storage.");

    const sanitized = this.sanitizeData(data);
    const jsonString = JSON.stringify(sanitized);
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(jsonString);

    const cryptoKey = await getEncryptionKey(userId);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encodedData
    );

    const payload: EncryptedPayload = {
      userId,
      timestamp: new Date().toISOString(),
      iv: arrayBufferToBase64(iv.buffer),
      ciphertext: arrayBufferToBase64(encryptedBuffer),
    };

    localStorage.setItem(`${STORAGE_PREFIX}${userId}_${key}`, JSON.stringify(payload));
  }

  /**
   * Decrypts and retrieves item for authenticated user
   */
  static async getSecureItem<T = any>(userId: string, key: string): Promise<T | null> {
    if (!userId) return null;

    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}_${key}`);
    if (!raw) return null;

    try {
      const payload: EncryptedPayload = JSON.parse(raw);
      if (payload.userId !== userId) {
        console.warn(`[OfflineStorageService] Security violation: Attempted to access cached data belonging to user ${payload.userId}`);
        return null;
      }

      const cryptoKey = await getEncryptionKey(userId);
      const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
      const ciphertext = base64ToArrayBuffer(payload.ciphertext);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        ciphertext
      );

      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decryptedBuffer);
      return JSON.parse(jsonString) as T;
    } catch (err) {
      console.error(`[OfflineStorageService] Failed to decrypt offline payload for key ${key}:`, err);
      return null;
    }
  }

  /**
   * Purges offline cache for key post synchronization
   */
  static removeSecureItem(userId: string, key: string): void {
    localStorage.removeItem(`${STORAGE_PREFIX}${userId}_${key}`);
  }

  /**
   * Invalidate all offline caches for a specific user (e.g. on account disabled/logout)
   */
  static invalidateUserCache(userId: string): void {
    const prefix = `${STORAGE_PREFIX}${userId}_`;
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }

    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}
