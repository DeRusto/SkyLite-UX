import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import prisma from "~/lib/prisma";
// eslint-disable-next-line perfectionist/sort-imports
import { decryptToken } from "../../../integrations/google-calendar/oauth";

/**
 * Immich Person type from Immich API
 */
type ImmichPerson = {
  id: string;
  name: string;
  birthDate: string | null;
  thumbnailPath: string;
  isHidden: boolean;
  type?: string; // "PERSON" or "PET" - available in newer Immich versions
};

/**
 * GET /api/integrations/immich/people
 * Fetches available Immich people (faces)
 *
 * Query params:
 * - integrationId: Required - the ID of the Immich integration
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const integrationId = query.integrationId as string;

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "integrationId query parameter is required",
    });
  }

  // Look up the integration
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw createError({
      statusCode: 404,
      message: "Integration not found",
    });
  }

  if (integration.type !== "photos" || integration.service !== "immich") {
    throw createError({
      statusCode: 400,
      message: "Invalid integration type - expected Immich photos integration",
    });
  }

  // Get credentials
  const storedApiKey = integration.apiKey;
  const baseUrl = integration.baseUrl;

  if (!storedApiKey || !baseUrl) {
    throw createError({
      statusCode: 400,
      message: "Immich integration is missing required configuration (API key or URL)",
    });
  }

  // Try to decrypt if encrypted, otherwise use as-is (plaintext API keys)
  let apiKey: string;
  try {
    apiKey = decryptToken(storedApiKey);
  }
  catch {
    // API key stored in plaintext (non-OAuth integrations)
    apiKey = storedApiKey;
  }

  try {
    // Fetch people from Immich API
    const response = await fetch(`${baseUrl}/api/people`, {
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage: string;
      switch (response.status) {
        case 401:
          errorMessage = "Authentication failed - check your API key";
          break;
        case 403:
          errorMessage = "Access denied - API key may lack required permissions";
          break;
        case 404:
          errorMessage = "Immich API endpoint not found - check your server URL";
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = "Immich server error - try again later";
          break;
        default:
          errorMessage = `Immich server responded with status ${response.status}`;
      }
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();

    // Immich API returns { people: [...], total: number, visible: number }
    const people: ImmichPerson[] = data.people || data;

    consola.info(`Fetched ${people.length} Immich people for integration ${integrationId}`);

    // Filter out hidden people
    const visiblePeople = people.filter(person => !person.isHidden);

    // Separate people and pets based on the type field
    const persons = visiblePeople
      .filter(p => !p.type || p.type === "PERSON")
      .map(person => ({
        id: person.id,
        name: person.name || "Unknown",
        birthDate: person.birthDate,
        thumbnailUrl: `/api/integrations/immich/people/${person.id}/thumbnail?integrationId=${integrationId}`,
        type: "person" as const,
      }));

    const pets = visiblePeople
      .filter(p => p.type === "PET")
      .map(pet => ({
        id: pet.id,
        name: pet.name || "Unknown Pet",
        birthDate: pet.birthDate,
        thumbnailUrl: `/api/integrations/immich/people/${pet.id}/thumbnail?integrationId=${integrationId}`,
        type: "pet" as const,
      }));

    // Transform to a standardized format
    return {
      people: persons,
      pets,
      total: visiblePeople.length,
    };
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw HTTP errors
    }

    consola.error("Error fetching Immich people:", error);

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to fetch people from Immich",
    });
  }
});
