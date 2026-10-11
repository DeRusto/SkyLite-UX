import prisma from "~/lib/prisma";

import { broadcastNativeDataChange } from "../../plugins/02.syncManager";

function getBaseCalendarEventId(id: string) {
  const match = id.match(/^(.+)-(\d{8}(?:T\d{6}Z?)?)$/);
  return match?.[1] || id;
}

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Calendar event ID is required",
      });
    }

    const actualId = getBaseCalendarEventId(id);
    const isExpandedEvent = actualId !== id;

    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id: actualId },
    });

    if (!existingEvent) {
      throw createError({
        statusCode: 404,
        message: "Calendar event not found",
      });
    }

    await prisma.calendarEvent.delete({
      where: { id: actualId },
    });

    // Broadcast the change to all connected clients (fork addition)
    broadcastNativeDataChange("calendar-events", "delete", actualId);

    return {
      success: true,
      message: isExpandedEvent
        ? "Entire recurring series deleted"
        : "Event deleted successfully",
    };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to delete calendar event: ${error}`,
    });
  }
});
