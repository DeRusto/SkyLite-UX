import consola from "consola";
import { isError } from "h3";

/**
 * Global error handler middleware.
 *
 * Hooks into the Nitro app's onError handler to catch raw (non-H3) errors
 * and format them into safe 500 responses, preventing stack traces and
 * internal error details from leaking to clients.
 *
 * H3Errors (from createError()) are passed through unchanged so their
 * statusCode, message, and data reach the client as intended.
 */
export default defineEventHandler(() => {
  const nitroApp = useNitroApp();

  // Register once — guard prevents re-registration on every request
  if (!nitroApp.h3App.options.onError) {
    nitroApp.h3App.options.onError = (error: unknown) => {
      // Pass H3Errors through unchanged (e.g. 400, 404 from createError())
      if (isError(error)) {
        return;
      }
      consola.error("[API] Unhandled server error:", error);
      throw createError({
        statusCode: 500,
        message: "Internal server error",
      });
    };
  }
});
