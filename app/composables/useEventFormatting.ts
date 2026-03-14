import type { CalendarEvent } from "~/types/calendar";

import { useStableDate } from "~/composables/useStableDate";
import { useTimezone } from "~/composables/useTimezone";

export function useEventFormatting() {
  const { parseStableDate } = useStableDate();
  const { getLocalTimeFromUTC, isSameUtcDay } = useTimezone();

  function getLocalTimeString(utcDate: Date, options?: Intl.DateTimeFormatOptions): string {
    const localDate = getLocalTimeFromUTC(utcDate);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    return localDate.toLocaleTimeString("en-US", { ...defaultOptions, ...options });
  }

  function getLocalDateString(utcDate: Date, options?: Intl.DateTimeFormatOptions): string {
    const localDate = getLocalTimeFromUTC(utcDate);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return localDate.toLocaleDateString("en-US", { ...defaultOptions, ...options });
  }

  function getEventDisplayTime(event: CalendarEvent): {
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string;
    isSameDay: boolean;
    isAllDay: boolean;
  } {
    const start = parseStableDate(event.start);
    const end = parseStableDate(event.end);

    const isSameDay = isSameUtcDay(start, end);
    const isAllDay = event.allDay || false;

    if (isAllDay) {
      return {
        startTime: "All day",
        endTime: "All day",
        startDate: getLocalDateString(start),
        endDate: getLocalDateString(end),
        isSameDay,
        isAllDay,
      };
    }

    return {
      startTime: getLocalTimeString(start),
      endTime: getLocalTimeString(end),
      startDate: getLocalDateString(start),
      endDate: getLocalDateString(end),
      isSameDay,
      isAllDay,
    };
  }

  function getEventStartTimeForInput(event: CalendarEvent): string {
    const start = parseStableDate(event.start);
    const localStart = getLocalTimeFromUTC(start);
    const hours = localStart.getHours().toString().padStart(2, "0");
    const minutes = localStart.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function getEventEndTimeForInput(event: CalendarEvent): string {
    const end = parseStableDate(event.end);
    const localEnd = getLocalTimeFromUTC(end);
    const hours = localEnd.getHours().toString().padStart(2, "0");
    const minutes = localEnd.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function getEventEndDateForInput(event: CalendarEvent): string {
    const start = parseStableDate(event.start);
    const end = parseStableDate(event.end);

    if (event.allDay) {
      const endDate = new Date(end.getTime());
      endDate.setDate(endDate.getDate() - 1);

      const year = endDate.getFullYear();
      const month = (endDate.getMonth() + 1).toString().padStart(2, "0");
      const day = endDate.getDate().toString().padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    else {
      const startLocal = getLocalTimeFromUTC(start);
      const endLocal = getLocalTimeFromUTC(end);

      const startDay = new Date(startLocal.getTime());
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date(endLocal.getTime());
      endDay.setHours(0, 0, 0, 0);

      if (startDay.getTime() === endDay.getTime()) {
        const year = startLocal.getFullYear();
        const month = (startLocal.getMonth() + 1).toString().padStart(2, "0");
        const day = startLocal.getDate().toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      else {
        const year = endLocal.getFullYear();
        const month = (endLocal.getMonth() + 1).toString().padStart(2, "0");
        const day = endLocal.getDate().toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
  }

  return {
    getLocalTimeString,
    getLocalDateString,
    getEventDisplayTime,
    getEventStartTimeForInput,
    getEventEndTimeForInput,
    getEventEndDateForInput,
  };
}
