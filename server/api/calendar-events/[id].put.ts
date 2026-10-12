import prisma from "~/lib/prisma";

import { broadcastNativeDataChange } from "../../plugins/02.syncManager";

function getBaseCalendarEventId(id: string) {
  const match = id.match(/^(.+)-(\d{8}(?:T\d{6}Z?)?)$/);
  return match?.[1] || id;
}

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);
    const { title, description, start, end, allDay, color, location, ical_event, users } = body;

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Calendar event ID is required",
      });
    }

    const actualId = getBaseCalendarEventId(id);
    const shouldUpdateMasterDates = id === actualId;
    const utcStart = shouldUpdateMasterDates ? new Date(start) : undefined;
    const utcEnd = shouldUpdateMasterDates ? new Date(end) : undefined;

    const calendarEvent = await prisma.calendarEvent.update({
      where: { id: actualId },
      data: {
        title,
        description,
        start: utcStart,
        end: utcEnd,
        allDay: allDay || false,
        color: color || null,
        location: location || null,
        ical_event: ical_event || null,
        users: {
          deleteMany: {},
          create: users?.map((user: { id: string }) => ({
            userId: user.id,
          })) || [],
        },
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                color: true,
              },
            },
          },
        },
      },
    });

    // Broadcast the change to all connected clients (fork addition)
    broadcastNativeDataChange("calendar-events", "update", calendarEvent.id);

    return {
      id: calendarEvent.id,
      title: calendarEvent.title,
      description: calendarEvent.description,
      start: calendarEvent.start,
      end: calendarEvent.end,
      allDay: calendarEvent.allDay,
      color: calendarEvent.color as string | string[] | undefined,
      location: calendarEvent.location,
      ical_event: calendarEvent.ical_event,
      users: (calendarEvent.users || []).map(ce => ce.user),
    };
  }
  catch (error: unknown) {
    // Handle record not found (deleted while viewing) — fork addition
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      throw createError({
        statusCode: 404,
        message: "Event not found. It may have been deleted.",
      });
    }
    throw createError({
      statusCode: 500,
      message: `Failed to update calendar event: ${error}`,
    });
  }
});
