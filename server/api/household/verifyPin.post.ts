import { consola } from "consola";
import { createError, defineEventHandler, getRequestIP, readBody } from "h3";

import prisma from "~/lib/prisma";

type VerifyPinBody = {
  pin: string;
};

// In-memory rate limiting: track failed attempts per IP
type RateLimitEntry = {
  count: number;
  lockedUntil: number;
};

const pinAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function pruneStaleAttempts(): void {
  const now = Date.now();
  for (const [key, entry] of pinAttempts.entries()) {
    if (entry.lockedUntil > 0 && entry.lockedUntil < now) {
      pinAttempts.delete(key);
    }
  }
}

function checkRateLimit(ip: string): void {
  pruneStaleAttempts();
  const entry = pinAttempts.get(ip);
  if (entry && entry.lockedUntil > Date.now()) {
    const remainingMs = entry.lockedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw createError({
      statusCode: 429,
      statusMessage: `Too many PIN attempts. Please try again in ${remainingMin} minute${remainingMin === 1 ? "" : "s"}.`,
    });
  }
}

function recordFailedAttempt(ip: string): void {
  let existing = pinAttempts.get(ip);
  // Reset counter if previous lockout has expired so the user gets a fresh set of attempts
  if (!existing || (existing.lockedUntil > 0 && existing.lockedUntil <= Date.now())) {
    existing = { count: 0, lockedUntil: 0 };
  }
  existing.count += 1;
  if (existing.count >= MAX_ATTEMPTS) {
    existing.lockedUntil = Date.now() + LOCKOUT_MS;
    consola.warn(`PIN: Too many failed attempts from IP ${ip}, locked for 15 minutes`);
  }
  pinAttempts.set(ip, existing);
}

function clearAttempts(ip: string): void {
  pinAttempts.delete(ip);
}

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event);
  if (!ip) {
    consola.warn("PIN: Unable to determine client IP for rate limiting");
    // Still allow the request but log the gap
    }
    else {
      checkRateLimit(ip);
    }

  const body = await readBody<VerifyPinBody>(event);

  if (!body.pin || typeof body.pin !== "string" || !/^\d{4}$/.test(body.pin)) {
    throw createError({
      statusCode: 400,
      statusMessage: "PIN must be a 4-digit number",
    });
  }

  const settings = await prisma.householdSettings.findFirst();

  if (!settings || !settings.adultPin) {
    // If no adult PIN is set, allow access
    return { valid: true };
  }

  // Verify PIN (supports both hashed and legacy plaintext)
  let isValid = await verifyPin(body.pin, settings.adultPin);

  // Migration: If verification failed, check if it's a legacy plaintext PIN
  if (!isValid && settings.adultPin === body.pin) {
    isValid = true;

    // Upgrade to hashed PIN
    try {
      const hashed = await hashPin(body.pin);
      await prisma.householdSettings.update({
        where: { id: settings.id },
        data: { adultPin: hashed },
      });
    }
    catch (error) {
      consola.error("Failed to migrate PIN:", error);
    }
  }

  if (isValid) {
    if (ip) clearAttempts(ip);
  }
  else {
    if (ip) recordFailedAttempt(ip);
  }

  return { valid: isValid };
});
