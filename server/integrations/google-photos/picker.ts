import { Buffer } from "node:buffer";

import { consola } from "consola";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Create a Photos Picker session
// ...
 * @param accessToken User's PLAIN access token
 * @returns The session object containing the pickerUri
 */
export async function createPickerSession(accessToken: string) {
  // const accessToken = decryptToken(encryptedAccessToken); // Token is now passed plain

  try {
    const response = await fetch("https://photospicker.googleapis.com/v1/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Configuration for the picker
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to create picker session: ${response.status} ${body}`);
    }

    return await response.json();
  }
  catch (error) {
    consola.error("Error creating picker session:", error);
    throw error;
  }
}

/**
 * Downloads media items from the Picker API selection.
 * @param items List of media items returned by the Picker
 * @param destinationDir Relative path to save images (e.g., 'backgrounds/imported')
 */
export async function downloadPickerItems(items: any[], destinationDir: string = "backgrounds/imported") {
  const publicDir = path.resolve(process.cwd(), "public");
  const saveDir = path.join(publicDir, destinationDir);

  // Ensure directory exists
  await fs.mkdir(saveDir, { recursive: true });

  const savedFiles: string[] = [];

  for (const item of items) {
    try {
      // Picker API returns a baseUrl.
      // Append =d to download the original file.
      const downloadUrl = `${item.mediaFile.baseUrl}=d`;
      const filename = `${item.id}.jpg`; // We assume JPG or handle extension based on mimeType if available
      // Note: Picker item structure: { id: "...", mediaFile: { baseUrl: "...", filename: "..." } }
      // Using original filename is better if valid
      const safeFilename = (item.mediaFile.filename || filename).replace(/[^a-z0-9.]/gi, "_");
      const filepath = path.join(saveDir, safeFilename);

      consola.info(`Downloading ${safeFilename}...`);

      const response = await fetch(downloadUrl);
      if (!response.ok)
        throw new Error(`Failed to fetch ${downloadUrl}: ${response.status}`);
      if (!response.body)
        throw new Error("No response body");

      // Write file using writeFile (buffer)
      // Actually standard node:fs/promises doesn't have createWriteStream. We need 'node:fs'.
      // I will fix imports in next step if this fails or just use writeFile with buffer.
      // writeFile with buffer is safer for memory if files are small, streams for large.
      // Let's use arrayBuffer -> Buffer -> writeFile for simplicity for now.

      const arrayBuffer = await response.arrayBuffer();
      await fs.writeFile(filepath, Buffer.from(arrayBuffer));

      savedFiles.push(`/${destinationDir}/${safeFilename}`);
    }
    catch (err) {
      consola.error(`Failed to download item ${item.id}:`, err);
    }
  }

  return savedFiles;
}

/**
 * Fetch media items from a picker session
/**
 * Fetch media items from a picker session
 * @param accessToken User's PLAIN access token
 * @param sessionId The ID of the picker session
 * @returns List of media items if available, or empty list
 */
export async function getPickerItems(accessToken: string, sessionId: string) {
  const encodedSessionId = encodeURIComponent(sessionId);
  const url = `https://photospicker.googleapis.com/v1/sessions/${encodedSessionId}/mediaItems`;

  const response = await fetch(`${url}?pageSize=100`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await response.text();
    throw new Error(`Failed to check picker session: ${response.status}`);
  }

  const data = await response.json();
  return data.mediaItems || [];
}
