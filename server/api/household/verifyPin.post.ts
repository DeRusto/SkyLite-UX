import prisma from "~/lib/prisma";

type VerifyPinBody = {
  pin: string;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<VerifyPinBody>(event);

  if (!body.pin) {
    throw createError({
      statusCode: 400,
      statusMessage: "PIN is required",
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
      console.error("Failed to migrate PIN:", error);
    }
  }

  return { valid: isValid };
});
