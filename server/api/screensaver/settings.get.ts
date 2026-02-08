import { defineEventHandler } from "h3";

import prisma from "~/lib/prisma";

/**
 * GET /api/screensaver/settings
 * Get screensaver settings (creates default if none exist)
 */
export default defineEventHandler(async () => {
  let settings = await prisma.screensaverSettings.findFirst();

  if (!settings) {
    settings = await prisma.screensaverSettings.create({
      data: {
        enabled: false,
        activationMode: "IDLE",
        idleTimeoutMinutes: 10,
        photoDisplaySeconds: 15,
        transitionEffect: "FADE",
        showClock: true,
        clockPosition: "bottom-right",
      },
    });
  }

  // Also fetch photo integrations (Immich, Google Photos) for album selection
  const photoIntegrations = await prisma.integration.findMany({
    where: {
      type: "photos",
      enabled: true,
    },
    select: {
      id: true,
      name: true,
      service: true,
      settings: true,
      enabled: true,
    },
  });

  return {
    ...settings,
    photoIntegrations,
  };
});
