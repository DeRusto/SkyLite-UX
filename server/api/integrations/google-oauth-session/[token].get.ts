import { consola } from "consola";
import { createError, defineEventHandler } from "h3";

import { consumeOAuthSession } from "../../../utils/oauthSessionStore";

export default defineEventHandler((event) => {
  const token = event.context.params?.token;
  if (!token) {
    throw createError({
      statusCode: 400,
      message: "OAuth session token is required",
    });
  }

  const session = consumeOAuthSession(token);
  if (!session) {
    consola.warn("OAuth session not found or expired for token (redacted)");
    throw createError({
      statusCode: 404,
      message: "OAuth session not found or expired",
    });
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiryDate: session.expiryDate,
    service: session.service,
  };
});
