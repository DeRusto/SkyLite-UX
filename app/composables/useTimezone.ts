import type { DateValue } from "@internationalized/date";

import { consola } from "consola";
import ical from "ical.js";

import { useStableDate } from "~/composables/useStableDate";
import { getBrowserTimezone, isTimezoneRegistered } from "~/types/global";

export function useTimezone() {
  const { parseStableDate } = useStableDate();

  function getSafeTimezone(): string {
    if (isTimezoneRegistered()) {
      const registeredTimezone = getBrowserTimezone();
      if (registeredTimezone) {
        return registeredTimezone;
      }
    }

    return "UTC";
  }

  function getUtcMidnightTime(date: Date): number {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    );
  }

  function isSameUtcDay(a: Date, b: Date): boolean {
    return getUtcMidnightTime(a) === getUtcMidnightTime(b);
  }

  function createICalTime(date: Date, isUTC: boolean = false): ical.Time {
    return ical.Time.fromJSDate(date, isUTC);
  }

  function isSameLocalDay(a: Date, b: Date, isAllDay: boolean = false): boolean {
    if (isAllDay) {
      return isSameUtcDay(a, b);
    }

    try {
      const browserTimezone = getSafeTimezone();
      const timezone = ical.TimezoneService.get(browserTimezone);

      if (!timezone) {
        return isSameUtcDay(a, b);
      }

      const timeA = createICalTime(a, true);
      const timeB = createICalTime(b, true);

      const localA = timeA.convertToZone(timezone);
      const localB = timeB.convertToZone(timezone);

      return localA.year === localB.year
        && localA.month === localB.month
        && localA.day === localB.day;
    }
    catch (error) {
      consola.debug("useTimezone: ical.js comparison failed, using UTC fallback:", error);
      return isSameUtcDay(a, b);
    }
  }

  function isLocalDayInRange(day: Date, start: Date, end: Date, isAllDay: boolean = false): boolean {
    if (isAllDay) {
      return day.getTime() >= start.getTime() && day.getTime() < end.getTime();
    }

    try {
      const browserTimezone = getSafeTimezone();
      const timezone = ical.TimezoneService.get(browserTimezone);

      if (!timezone) {
        return day.getTime() >= start.getTime() && day.getTime() < end.getTime();
      }

      const timeDay = createICalTime(day, true);
      const timeStart = createICalTime(start, true);
      const timeEnd = createICalTime(end, true);

      const localDay = timeDay.convertToZone(timezone);
      const localStart = timeStart.convertToZone(timezone);
      const localEnd = timeEnd.convertToZone(timezone);

      const dayMidnight = new Date(localDay.year, localDay.month - 1, localDay.day);
      const startMidnight = new Date(localStart.year, localStart.month - 1, localStart.day);
      const endMidnight = new Date(localEnd.year, localEnd.month - 1, localEnd.day);

      return dayMidnight.getTime() >= startMidnight.getTime()
        && dayMidnight.getTime() <= endMidnight.getTime();
    }
    catch (error) {
      consola.debug("useTimezone: ical.js comparison failed, using UTC fallback:", error);
      return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
    }
  }

  function createLocalDate(year: number, month: number, day: number): Date {
    const utcTime = Date.UTC(year, month, day);
    return new Date(utcTime);
  }

  function getLocalTimeFromUTC(utcDate: Date): Date {
    try {
      const browserTimezone = getSafeTimezone();
      const timezone = ical.TimezoneService.get(browserTimezone);

      if (timezone) {
        const utcTime = createICalTime(utcDate, true);
        const localTime = utcTime.convertToZone(timezone);
        return new Date(localTime.year, localTime.month - 1, localTime.day, localTime.hour, localTime.minute, localTime.second);
      }

      return new Date(utcDate.getTime());
    }
    catch (error) {
      consola.warn("useTimezone: ical.js timezone conversion failed, using fallback:", error);
      return new Date(utcDate.getTime());
    }
  }

  function getLocalWeekDays(startDate: Date): Date[] {
    const days: Date[] = [];
    const start = getLocalTimeFromUTC(startDate);

    for (let i = 0; i < 7; i++) {
      const day = parseStableDate(new Date(start.getTime()));
      day.setDate(start.getDate() + i);
      days.push(day);
    }

    return days;
  }

  function getLocalMonthWeeks(date: Date): Date[][] {
    const localDate = getLocalTimeFromUTC(date);
    const firstDayOfMonth = new Date(localDate.getFullYear(), localDate.getMonth(), 1);
    const lastDayOfMonth = new Date(localDate.getFullYear(), localDate.getMonth() + 1, 0);

    const startDate = parseStableDate(new Date(firstDayOfMonth.getTime()));
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const endDate = parseStableDate(new Date(lastDayOfMonth.getTime()));
    const endDayOfWeek = endDate.getDay();
    endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));

    const weeks: Date[][] = [];
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 7) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const dayDate = parseStableDate(new Date(startDate.getTime()));
        dayDate.setDate(startDate.getDate() + dayIndex + i);
        week.push(dayDate);
      }
      weeks.push(week);
    }

    return weeks;
  }

  function getLocalAgendaDays(date: Date): Date[] {
    const days: Date[] = [];
    const localDate = getLocalTimeFromUTC(date);

    for (let i = -15; i < 15; i++) {
      const day = parseStableDate(new Date(localDate.getTime()));
      day.setDate(localDate.getDate() + i);
      days.push(day);
    }

    return days;
  }

  function createLocalDateTime(dateValue: DateValue, timeString: string, timezone: string): Date {
    const [hours = 0, minutes = 0] = timeString.split(":").map(Number);
    const localDate = dateValue.toDate(timezone);
    localDate.setHours(hours, minutes, 0, 0);
    return localDate;
  }

  function convertLocalToUTC(localDate: Date): Date {
    const utcTime = Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours(),
      localDate.getMinutes(),
      localDate.getSeconds(),
      localDate.getMilliseconds(),
    );
    return new Date(utcTime);
  }

  return {
    getSafeTimezone,
    getUtcMidnightTime,
    isSameUtcDay,
    createICalTime,
    isSameLocalDay,
    isLocalDayInRange,
    createLocalDate,
    getLocalTimeFromUTC,
    getLocalWeekDays,
    getLocalMonthWeeks,
    getLocalAgendaDays,
    createLocalDateTime,
    convertLocalToUTC,
  };
}
