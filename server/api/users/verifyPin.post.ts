import { consola } from "consola";
import { z } from "zod";

import prisma from "~/lib/prisma";

const verifyPinSchema = z.object({
  userId: z.string().cuid(),
  pin: z.string().length(4).regex(/^\d+$/),
});

// In-memory rate limiting: track failed attempts per userId
type RateLimitEntry = {
  count: number;
  lockedUntil: number;
  firstAttemptAt: number;
};

const pinAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function pruneStaleAttempts(): void {
  const now = Date.now();
  for (const [key, entry] of pinAttempts.entries()) {
    const expired = entry.lockedUntil > 0 && entry.lockedUntil < now;
    const stale = entry.lockedUntil === 0 && (now - entry.firstAttemptAt) > LOCKOUT_MS;
    if (expired || stale) {
      pinAttempts.delete(key);
    }
  }
}

function checkRateLimit(userId: string): void {
  pruneStaleAttempts();
  const entry = pinAttempts.get(userId);
  if (entry && entry.lockedUntil > Date.now()) {
    const remainingMs = entry.lockedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw createError({
      statusCode: 429,
      statusMessage: `Too many PIN attempts. Please try again in ${remainingMin} minute${remainingMin === 1 ? "" : "s"}.`,
    });
  }
}

function recordFailedAttempt(userId: string): void {
  const raw = pinAttempts.get(userId);
  // Reset counter if previous lockout has expired so the user gets a fresh set of attempts
  const existing: RateLimitEntry = (!raw || (raw.lockedUntil > 0 && raw.lockedUntil <= Date.now()))
    ? { count: 0, lockedUntil: 0, firstAttemptAt: Date.now() }
    : raw;
  existing.count += 1;
  if (existing.count >= MAX_ATTEMPTS) {
    existing.lockedUntil = Date.now() + LOCKOUT_MS;
    consola.warn(`PIN: Too many failed attempts for user ${userId}, locked for 15 minutes`);
  }
  pinAttempts.set(userId, existing);
}

function clearAttempts(userId: string): void {
  pinAttempts.delete(userId);
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { userId, pin } = await verifyPinSchema.parseAsync(body);

  checkRateLimit(userId);

  // Verify the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  // If the user has a specific PIN, verify it
  if (user.pin) {
    const isValid = await verifyPin(pin, user.pin);
    if (isValid) {
      clearAttempts(userId);
    }
    else {
      recordFailedAttempt(userId);
    }
    return { valid: isValid };
  }

  // Fallback: check household settings adult PIN
  const settings = await prisma.householdSettings.findFirst();

  if (!settings || !settings.adultPin) {
    // When neither user settings nor household settings provide a PIN (settings or settings.adultPin is falsy),
    // the endpoint intentionally treats the PIN as valid only for users where user.role is "ADULT".
    return { valid: user.role === "ADULT" };
  }

  // Verify against household PIN as fallback
  let isValid = await verifyPin(pin, settings.adultPin);

  // Migration: If verification failed, check if it's a legacy plaintext PIN
  if (!isValid && settings.adultPin === pin) {
    isValid = true;

    // Upgrade to hashed PIN
    try {
      const hashed = await hashPin(pin);
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
    clearAttempts(userId);
  }
  else {
    recordFailedAttempt(userId);
  }

  return { valid: isValid };
});
