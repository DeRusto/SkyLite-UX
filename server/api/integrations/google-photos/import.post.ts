import { consola } from "consola";
import { createError, defineEventHandler, readBody } from "h3";

import { downloadPickerItems } from "../../../integrations/google-photos/picker";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { items } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw createError({
      statusCode: 400,
      message: "No items provided for import",
    });
  }

  try {
    const savedFiles = await downloadPickerItems(items);

    // Here strictly we should also update the integration settings or return the paths
    // so the frontend can update the 'backgrounds' setting.
    // For now, we return the paths.

    return {
      success: true,
      importedCount: savedFiles.length,
      files: savedFiles,
    };
  }
  catch (error) {
    consola.error("Failed to import photos:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to import photos",
    });
  }
});
