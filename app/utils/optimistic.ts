/**
 * Helper to perform an optimistic update.
 *
 * @param request - The async function that performs the API call.
 * @param apply - The synchronous function that applies the optimistic change to the reactive state.
 * @param rollback - The synchronous function that reverts the state if the request fails.
 * @returns The result of the request.
 */
export async function performOptimisticUpdate<T>(
  request: () => Promise<T>,
  apply: () => void,
  rollback: () => void,
): Promise<T> {
  apply();
  try {
    return await request();
  }
  catch (err) {
    rollback();
    throw err;
  }
}
