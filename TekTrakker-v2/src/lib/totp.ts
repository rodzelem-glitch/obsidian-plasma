/**
 * Lightweight, high-performance, native Web Cryptography TOTP (Time-based One-Time Password) utilities.
 * Designed with ZERO external dependencies to run seamlessly in modern browsers and Capacitor WebViews.
 */

/**
 * Decodes a base32 encoded string into a Uint8Array.
 * Follows RFC 4648 specification.
 */
export function base32ToBuf(str: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = str.toUpperCase().replace(/\s/g, '').replace(/=+$/, '');
    const len = cleaned.length;
    const buf = new Uint8Array(Math.floor((len * 5) / 8));
    
    let bits = 0;
    let val = 0;
    let index = 0;
    
    for (let i = 0; i < len; i++) {
        const charVal = alphabet.indexOf(cleaned[i]);
        if (charVal === -1) {
            throw new Error('Invalid base32 character in key: ' + cleaned[i]);
        }
        val = (val << 5) | charVal;
        bits += 5;
        if (bits >= 8) {
            buf[index++] = (val >> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    
    return buf;
}

/**
 * Encodes a Uint8Array into a base32 string.
 */
export function bufToBase32(buf: Uint8Array): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';
    
    for (let i = 0; i < buf.length; i++) {
        value = (value << 8) | buf[i];
        bits += 8;
        while (bits >= 5) {
            output += alphabet[(value >> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    
    if (bits > 0) {
        output += alphabet[(value << (5 - bits)) & 31];
    }
    
    return output;
}

/**
 * Generates a standard 6-digit TOTP code for a given secret and optional time offset.
 * Uses native window.crypto.subtle HMAC-SHA-1 calculations.
 */
export async function generateTOTP(secret: string, timeOffset = 0): Promise<string> {
    const keyBuf = base32ToBuf(secret);
    
    // counter step is derived from Unix epoch / 30 seconds
    const counter = Math.floor(Date.now() / 1000 / 30) + timeOffset;
    
    // Construct 8-byte big-endian counter buffer
    const counterBuf = new Uint8Array(8);
    let temp = counter;
    for (let i = 7; i >= 0; i--) {
        counterBuf[i] = temp & 255;
        temp = Math.floor(temp / 256);
    }
    
    const crypto = window.crypto || (window as any).msCrypto;
    if (!crypto || !crypto.subtle) {
        throw new Error('Web Cryptography API is not supported by this platform environment.');
    }
    
    // Import raw key buffer into SubtleCrypto HMAC key object
    const hmacKey = await crypto.subtle.importKey(
        'raw',
        keyBuf,
        { name: 'HMAC', hash: { name: 'SHA-1' } },
        false,
        ['sign']
    );
    
    // Generate HMAC signature of counter buffer
    const signature = await crypto.subtle.sign('HMAC', hmacKey, counterBuf);
    const hmac = new Uint8Array(signature);
    
    // Perform Dynamic Truncation (RFC 4226 Section 5.4)
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
        
    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
}

/**
 * Verifies a user-supplied TOTP code against a secret key.
 * Features customizable ±30s drift tolerance to allow minor clock deviations on user devices.
 */
export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
    const cleanedCode = code.trim().replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleanedCode)) return false;
    
    // Evaluate counter drift window: -1 (past 30s), 0 (current), +1 (next 30s)
    for (let offset = -1; offset <= 1; offset++) {
        try {
            const calculated = await generateTOTP(secret, offset);
            if (calculated === cleanedCode) {
                return true;
            }
        } catch (e) {
            console.error('Error generating verification TOTP token:', e);
        }
    }
    
    return false;
}

/**
 * Generates a secure, cryptographically random base32 encoded secret key.
 * Default length is 16 bytes (80 bits) which produces a standard 26-character base32 secret.
 */
export function generateRandomSecret(byteLength = 16): string {
    const array = new Uint8Array(byteLength);
    const crypto = window.crypto || (window as any).msCrypto;
    crypto.getRandomValues(array);
    return bufToBase32(array);
}

/**
 * Helper to construct the standard otpauth URI used for Authenticator QR Codes.
 */
export function getOtpauthUri(secret: string, label: string, issuer = 'TekTrakker'): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedLabel = encodeURIComponent(label);
    return `otpauth://totp/${encodedIssuer}:${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
