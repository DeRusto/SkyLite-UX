import consola from "consola";

/**
 * Creates a 400 validation error with field-specific information.
 */
export function createValidationError(field: string, message: string) {
  return createError({
    statusCode: 400,
    statusMessage: "Validation Error",
    data: { field, message },
    message,
  });
}

/**
 * Creates a 404 not found error for a specific resource.
 */
export function createNotFoundError(resource: string, id: string) {
  return createError({
    statusCode: 404,
    message: `${resource} with id '${id}' not found`,
  });
}

/**
 * Creates a 500 server error, logging the original error server-side without
 * exposing internal details to the client.
 */
export function createServerError(operation: string, error: unknown) {
  consola.error(`[API] Failed to ${operation}:`, error);
  return createError({
    statusCode: 500,
    message: `Failed to ${operation}`,
  });
}

/**
 * Validates that all required fields are present in the request body.
 * Throws a 400 validation error if any field is missing or empty.
 */
export function validateRequired(body: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    const value = body[field];
    if (value === undefined || value === null || value === "") {
      throw createValidationError(field, `${field} is required`);
    }
  }
}
