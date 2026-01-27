import { Buffer } from "node:buffer";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Hashes a PIN using scrypt with a random salt.
 * @param pin The PIN to hash.
 * @returns The salt and hash separated by a colon (salt:hash).
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(pin, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a PIN against a stored hash.
 * @param storedHash The stored hash in the format salt:hash.
 * @param pin The PIN to verify.
 * @returns True if the PIN is valid, false otherwise.
 */
export async function verifyPin(storedHash: string | null | undefined, pin: string): Promise<boolean> {
  if (!storedHash) return false;

  const parts = storedHash.split(":");

  // Legacy support: If not in format salt:hash, assume plaintext and compare directly
  if (parts.length !== 2) {
    return storedHash === pin;
  }

  const [salt, key] = parts;
  if (!salt || !key) return false;

  try {
    const derivedKeyBuffer = (await scryptAsync(pin, salt, 64)) as Buffer;
    const keyBuffer = Buffer.from(key, "hex");

    // Check buffer lengths match before comparing to prevent errors
    if (derivedKeyBuffer.length !== keyBuffer.length) {
        return false;
    }

    return timingSafeEqual(derivedKeyBuffer, keyBuffer);
  } catch {
    // Fail closed on any error (e.g. invalid hex encoding)
    return false;
  }
}
