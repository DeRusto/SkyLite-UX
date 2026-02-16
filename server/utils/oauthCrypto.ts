import { consola } from "consola";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";

/**
 * Get encryption key from environment, validating length
 * @returns 32-byte encryption key buffer
 */
export function getEncryptionKey(): Buffer {
  const config = useRuntimeConfig();
  const envKey = config.oauthEncryptionKey as string;

  if (envKey) {
    const keyBuffer = Buffer.from(envKey, "hex");
    if (keyBuffer.length !== 32) {
      consola.error(`Invalid encryption key length: ${keyBuffer.length} bytes. Expected 32 bytes (64 hex characters).`);
      throw new Error(`Invalid OAUTH_ENCRYPTION_KEY length: ${keyBuffer.length} bytes. Expected 32 bytes.`);
    }
    return keyBuffer;
  }

  // Development fallback - generate temporary key
  if (import.meta.dev) {
    consola.warn("OAUTH_ENCRYPTION_KEY not set, using temporary random key (will cause decryption failures!)");
    return crypto.randomBytes(32);
  }

  throw new Error("OAUTH_ENCRYPTION_KEY environment variable is required");
}

/**
 * Encrypt OAuth token using AES-256-GCM
 * @param token - Plain text token to encrypt
 * @returns Encrypted token in format: iv:authTag:encrypted
 */
export function encryptToken(token: string): string {
  const algorithm = "aes-256-gcm";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt OAuth token using AES-256-GCM
 * Handles plaintext tokens by returning them unchanged with a warning
 * @param encryptedToken - Encrypted token in format: iv:authTag:encrypted
 * @returns Decrypted plain text token
 */
export function decryptToken(encryptedToken: string): string {
  // If token doesn't look like it's encrypted (no colons), return as is
  // This happens during initial setup when frontend passes plaintext tokens
  if (!encryptedToken.includes(":")) {
    consola.warn("OAuth decryption: Token appears to be plaintext (no colons found), returning unchanged.");
    return encryptedToken;
  }

  const parts = encryptedToken.split(":");
  if (parts.length !== 3) {
    consola.warn(`OAuth decryption: Token has ${parts.length} parts, expected 3. Returning unchanged.`);
    return encryptedToken;
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const hexRegex = /^[0-9a-f]+$/i;

  if (!ivHex || !authTagHex || !encrypted || !hexRegex.test(ivHex) || !hexRegex.test(authTagHex) || !hexRegex.test(encrypted)) {
    consola.warn("OAuth decryption: Token parts are not valid non-empty hex strings. Returning unchanged.");
    return encryptedToken;
  }

  try {
    const algorithm = "aes-256-gcm";
    const key = getEncryptionKey();

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
  catch (error) {
    consola.error("OAuth decryption failed:", error instanceof Error ? error.message : "Unknown error");
    return encryptedToken;
  }
}
