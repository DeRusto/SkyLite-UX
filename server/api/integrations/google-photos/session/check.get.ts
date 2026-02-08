import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import { getPickerItems } from "../../../../integrations/google-photos/picker";
import { ensureValidAccessToken } from "../../../../integrations/google-photos/token";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { sessionId, integrationId } = query;

  if (!sessionId || typeof sessionId !== "string" || !integrationId) {
    throw createError({
      statusCode: 400,
      message: "Session ID and Integration ID are required",
    });
  }

  try {
    const accessToken = await ensureValidAccessToken(String(integrationId));
    const items = await getPickerItems(accessToken, sessionId);

    return {
      ready: items.length > 0,
      count: items.length,
      items,
    };
  }
  catch (error) {
    // If it's just "no items yet" it might throw or return empty.
    // The API usually returns empty list if session exists but no items picked yet?
    // Actually documentation says "mediaItems" field is absent if no items.
    // So our code `return data.mediaItems || []` handles it.

    // But if error is 400/404, session is gone.
    consola.warn("Polling picker session:", error);
    return { ready: false, count: 0, items: [] };
  }
});
