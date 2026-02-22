import { consola } from "consola";
import { createError, defineEventHandler, getHeader, setResponseHeaders } from "h3";

import { syncManager } from "../../plugins/02.syncManager";

export default defineEventHandler(async (event) => {
  try {
    // Restrict CORS to same-origin requests only for SSE stream
    const requestOrigin = getHeader(event, "origin");
    const allowedOrigin = requestOrigin || "null";
    setResponseHeaders(event, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "Cache-Control",
      "Vary": "Origin",
    });

    syncManager.registerClient(event);

    const initialEvent = {
      type: "connection_established",
      timestamp: new Date(),
      message: "Connected to sync stream",
    };

    event.node.res.write(`data: ${JSON.stringify(initialEvent)}\n\n`);

    const activeSyncIntervals = syncManager.getActiveSyncIntervals();
    const statusEvent = {
      type: "sync_status",
      timestamp: new Date(),
      activeIntegrations: activeSyncIntervals,
      connectedClients: syncManager.getConnectedClientsCount(),
    };

    event.node.res.write(`data: ${JSON.stringify(statusEvent)}\n\n`);

    const heartbeatInterval = setInterval(() => {
      try {
        const heartbeatEvent = {
          type: "heartbeat",
          timestamp: new Date(),
        };
        event.node.res.write(`data: ${JSON.stringify(heartbeatEvent)}\n\n`);
      }
      catch {
        consola.warn("Sync Events: Failed to send heartbeat, client may have disconnected");
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    event.node.req.on("close", () => {
      consola.info("Sync Events: Client disconnected from sync stream");
      clearInterval(heartbeatInterval);
      syncManager.unregisterClient(event);
    });

    event.node.req.on("error", (err) => {
      if (import.meta.dev && err.message?.includes("aborted")) {
        consola.debug("Sync Events: Client disconnected (expected during dev)");
      }
      else {
        consola.error("Sync Events: Error in sync stream connection:", err);
      }
      clearInterval(heartbeatInterval);
      syncManager.unregisterClient(event);
    });

    return new Promise(() => {
    });
  }
  catch (error) {
    consola.error("Sync Events: Error setting up sync stream:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to establish sync stream",
    });
  }
});
