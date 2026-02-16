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

  // PIN is stored on household settings, not on the user model
  const settings = await prisma.householdSettings.findFirst();

  if (!settings || !settings.parentPin) {
    return { valid: false };
  }

  const isValid = settings.parentPin === pin;

  return { valid: isValid };
});
