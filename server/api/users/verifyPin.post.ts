import { consola } from "consola";
import { z } from "zod";

import prisma from "~/lib/prisma";

const verifyPinSchema = z.object({
  userId: z.string().cuid(),
  pin: z.string().length(4).regex(/^\d+$/),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { userId, pin } = await verifyPinSchema.parseAsync(body);

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

  return { valid: isValid };
});
