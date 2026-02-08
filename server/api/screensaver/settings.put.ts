import { defineEventHandler, readBody } from "h3";

import prisma from "~/lib/prisma";

/**
 * PUT /api/screensaver/settings
 * Update screensaver settings
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

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

  const updated = await prisma.screensaverSettings.update({
    where: { id: settings.id },
    data: {
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      ...(body.activationMode && { activationMode: body.activationMode }),
      ...(body.idleTimeoutMinutes !== undefined && { idleTimeoutMinutes: body.idleTimeoutMinutes }),
      ...(body.scheduleStart !== undefined && { scheduleStart: body.scheduleStart }),
      ...(body.scheduleEnd !== undefined && { scheduleEnd: body.scheduleEnd }),
      ...(body.photoDisplaySeconds !== undefined && { photoDisplaySeconds: body.photoDisplaySeconds }),
      ...(body.transitionEffect && { transitionEffect: body.transitionEffect }),
      ...(body.showClock !== undefined && { showClock: body.showClock }),
      ...(body.clockPosition && { clockPosition: body.clockPosition }),
    },
  });

  return updated;
});
