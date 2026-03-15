import { consola } from "consola";
import { format } from "date-fns";

import type { CalendarEvent, PlaceholderEvent } from "~/types/calendar";
import type { Integration } from "~/types/database";

import { useEventColors } from "~/composables/useEventColors";
import { useEventFormatting } from "~/composables/useEventFormatting";
import { useStableDate } from "~/composables/useStableDate";
import { useSyncManager } from "~/composables/useSyncManager";
import { useTimezone } from "~/composables/useTimezone";
import { useUsers } from "~/composables/useUsers";

export function useCalendar() {
  const { data: nativeEvents } = useNuxtData<CalendarEvent[]>("calendar-events");

  const { integrations } = useIntegrations();
  const { users } = useUsers();

  const { getSyncDataByType, getCachedIntegrationData } = useSyncManager();
  const { getStableDate, parseStableDate } = useStableDate();

  // Delegate to focused composables
  const {
    isSameUtcDay,
    isSameLocalDay,
    isLocalDayInRange,
    createLocalDate,
    getLocalTimeFromUTC,
    getLocalWeekDays,
    getLocalMonthWeeks,
    getLocalAgendaDays,
    createLocalDateTime,
    convertLocalToUTC,
  } = useTimezone();

  const {
    getLocalTimeString,
    getLocalDateString,
    getEventDisplayTime,
    getEventStartTimeForInput,
    getEventEndTimeForInput,
    getEventEndDateForInput,
  } = useEventFormatting();

  const {
    lightenColor,
    getLuminance,
    getTextColor,
    getAverageTextColor,
    getEventUserColors,
    combineEvents,
    getEventColorClasses,
  } = useEventColors();

  const allEvents = computed(() => {
    const events: CalendarEvent[] = [];

    if (nativeEvents.value) {
      events.push(...nativeEvents.value);
    }

    const calendarIntegrations = (integrations.value as readonly Integration[] || []).filter(integration =>
      integration.type === "calendar" && integration.enabled,
    );

    const usersList = users.value || [];

    calendarIntegrations.forEach((integration) => {
      try {
        const integrationEvents = getCachedIntegrationData("calendar", integration.id) as CalendarEvent[];

        if (integrationEvents && Array.isArray(integrationEvents)) {
          const eventsWithIntegrationId = integrationEvents.map((event) => {
            // Find users linked to this integration and calendar
            // For iCal, we match by integrationId as the "calendar" is the integration itself
            const linkedUsers = usersList.filter(u =>
              u.calendarIntegrationId === integration.id
              && (u.calendarId === event.calendarId || integration.service === "iCal"),
            );

            const eventUsers = [...(event.users || [])];
            linkedUsers.forEach((u) => {
              if (!eventUsers.some(eu => eu.id === u.id)) {
                eventUsers.push({
                  id: u.id,
                  name: u.name,
                  avatar: u.avatar || null,
                  color: u.color || null,
                });
              }
            });

            return {
              ...event,
              integrationId: integration.id,
              integrationName: integration.name || "Unknown",
              users: eventUsers,
            };
          });
          events.push(...eventsWithIntegrationId);
        }
      }
      catch (error) {
        consola.warn(`Use Calendar: Failed to get calendar events for integration ${integration.id}:`, error);
      }
    });

    return combineEvents(events);
  });

  const calendarSyncStatus = computed(() => getSyncDataByType("calendar", []));

  const refreshCalendarData = async () => {
    try {
      await refreshNuxtData("calendar-events");
      consola.debug("Use Calendar: Calendar data refreshed successfully");
    }
    catch (error) {
      consola.error("Use Calendar: Failed to refresh calendar data:", error);
    }
  };

  const getIntegrationEvents = (integrationId: string): CalendarEvent[] => {
    try {
      const events = getCachedIntegrationData("calendar", integrationId) as CalendarEvent[];
      return events && Array.isArray(events) ? events : [];
    }
    catch (error) {
      consola.warn(`Use Calendar: Failed to get events for integration ${integrationId}:`, error);
      return [];
    }
  };

  function isToday(date: Date) {
    return isSameUtcDay(date, getStableDate());
  }

  function handleEventClick(
    calendarEvent: CalendarEvent,
    e: MouseEvent,
    emit: (name: "eventClick", event: CalendarEvent, e: MouseEvent) => void,
  ) {
    emit("eventClick", calendarEvent, e);
  }

  function scrollToDate(date: Date, view: "month" | "week" | "day" | "agenda") {
    if (view === "month") {
      const dateElement = document.querySelector(`[data-date="${format(date, "yyyy-MM-dd")}"]`);
      if (dateElement) {
        const headerHeight = 80;
        const padding = 20;
        const elementPosition = dateElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight - padding;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    }
    else if (view === "agenda") {
      const targetDate = format(date, "yyyy-MM-dd");
      const dateElement = document.querySelector(`[data-date="${targetDate}"]`);

      if (dateElement) {
        const scrollableContainer = dateElement.closest(".overflow-y-auto");

        if (scrollableContainer) {
          const containerRect = scrollableContainer.getBoundingClientRect();
          const elementRect = dateElement.getBoundingClientRect();
          const scrollTop = scrollableContainer.scrollTop + (elementRect.top - containerRect.top) - 20;

          scrollableContainer.scrollTo({
            top: scrollTop,
            behavior: "smooth",
          });
        }
      }
    }
  }

  function computedEventHeight(view: "month" | "week" | "day", customHeight?: number) {
    const defaultHeights = {
      month: 40,
      week: 64,
      day: 48,
    };

    return customHeight || defaultHeights[view];
  }

  function isSelectedDate(date: Date, selectedDate: Date) {
    return isSameUtcDay(date, selectedDate);
  }

  function handleDateSelect(date: Date, emit: (event: "dateSelect", date: Date) => void) {
    emit("dateSelect", date);
  }

  function getMiniCalendarWeeks(currentDate: Date): Date[][] {
    return getLocalMonthWeeks(currentDate);
  }

  function getAgendaEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
    return events
      .filter((event) => {
        const eventStart = parseStableDate(event.start);
        const eventEnd = parseStableDate(event.end);

        return (
          isSameLocalDay(day, eventStart, event.allDay)
          || isLocalDayInRange(day, eventStart, eventEnd, event.allDay)
        );
      })
      .sort((a, b) => {
        const aStart = parseStableDate(a.start).getTime();
        const bStart = parseStableDate(b.start).getTime();
        return aStart - bStart;
      });
  }

  function getAllEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
    return events.filter((event) => {
      const eventStart = parseStableDate(event.start);
      const eventEnd = parseStableDate(event.end);
      return isSameLocalDay(day, eventStart, event.allDay) || isLocalDayInRange(day, eventStart, eventEnd, event.allDay);
    });
  }

  function getEventsForDateRange(start: Date, end: Date): CalendarEvent[] {
    return allEvents.value.filter((event) => {
      const eventStart = parseStableDate(event.start);
      const eventEnd = parseStableDate(event.end);
      return eventStart <= end && eventEnd >= start;
    });
  }

  function isPlaceholderEvent(event: CalendarEvent): boolean {
    return event.id.startsWith("__placeholder_") || (event as PlaceholderEvent).isPlaceholder === true;
  }

  function createPlaceholderEvent(position: number): PlaceholderEvent {
    return {
      id: `__placeholder_${position}`,
      title: "",
      start: new Date(0),
      end: new Date(0),
      allDay: false,
      isPlaceholder: true,
      position,
    };
  }

  function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
    return [...events].sort((a, b) => {
      return parseStableDate(a.start).getTime() - parseStableDate(b.start).getTime();
    });
  }

  return {
    allEvents: readonly(allEvents),
    calendarSyncStatus: readonly(calendarSyncStatus),
    nativeEvents: readonly(nativeEvents),

    refreshCalendarData,
    getIntegrationEvents,

    isToday,
    handleEventClick,
    scrollToDate,
    computedEventHeight,
    isSelectedDate,
    handleDateSelect,
    getMiniCalendarWeeks,
    getAgendaEventsForDay,
    getAllEventsForDay,
    getEventsForDateRange,
    createPlaceholderEvent,
    isPlaceholderEvent,
    sortEvents,
    lightenColor,
    getTextColor,
    getLuminance,
    getAverageTextColor,
    getEventColorClasses,
    combineEvents,
    getEventUserColors,

    getLocalTimeFromUTC,
    getLocalTimeString,
    getLocalDateString,
    getEventDisplayTime,
    getEventStartTimeForInput,
    getEventEndTimeForInput,
    getEventEndDateForInput,
    createLocalDateTime,
    convertLocalToUTC,
    isSameLocalDay,
    isLocalDayInRange,

    createLocalDate,
    getLocalWeekDays,
    getLocalMonthWeeks,
    getLocalAgendaDays,
  };
}
