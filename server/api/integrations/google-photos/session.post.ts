import { consola } from "consola";
import { createError, defineEventHandler, readBody } from "h3";

import { createPickerSession } from "../../../integrations/google-photos/picker";
import { ensureValidAccessToken } from "../../../integrations/google-photos/token";
// import prisma from "~/lib/prisma"; // Unused if helper handles access

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const integrationId = body.integrationId;

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "Integration ID is required",
    });
  }

  try {
    const accessToken = await ensureValidAccessToken(integrationId);
    const session = await createPickerSession(accessToken);
    return {
      pickerUri: session.pickerUri as string,
      sessionId: session.id as string,
    };
  }
  catch (error) {
    consola.error("Failed to create picker session:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create picker session",
    });
  }
});
