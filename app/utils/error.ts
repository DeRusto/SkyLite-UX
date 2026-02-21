/**
 * Shape of an error returned by Nuxt/Fetch.
 */
export type FetchErrorShape = {
  data?: { message?: string };
  statusMessage?: string;
  message?: string;
};

/**
 * Named type for Nuxt Fetch Errors to be used in casts and signatures.
 */
export type NuxtFetchError = FetchErrorShape;

/**
 * Utility to extract a human-readable error message from an API error.
 * Handles Nuxt $fetch errors, standard Errors, and fallback messages.
 */
export function getErrorMessage(err: unknown, fallback = "An unexpected error occurred"): string {
  if (!err)
    return fallback;

  // Handle Nuxt/Fetch errors which often have a 'data' property with a message
  const fetchError = err as FetchErrorShape;

  if (fetchError.data?.message) {
    return fetchError.data.message;
  }

  if (fetchError.statusMessage) {
    return fetchError.statusMessage;
  }

  if (fetchError.message) {
    return fetchError.message;
  }

  if (typeof err === "string") {
    return err;
  }

  return fallback;
}
