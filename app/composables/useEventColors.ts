import type { CalendarEvent } from "~/types/calendar";

import { useStableDate } from "~/composables/useStableDate";

export function useEventColors() {
  const { parseStableDate } = useStableDate();

  function parseHexRGB(hex: string): [number, number, number] {
    const color = hex.replace("#", "");
    return [
      Number.parseInt(color.substring(0, 2), 16),
      Number.parseInt(color.substring(2, 4), 16),
      Number.parseInt(color.substring(4, 6), 16),
    ];
  }

  function lightenColor(hex: string, amount: number = 0.3): string {
    const [r, g, b] = parseHexRGB(hex);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${toHex(Math.round(r + (255 - r) * amount))}${toHex(Math.round(g + (255 - g) * amount))}${toHex(Math.round(b + (255 - b) * amount))}`;
  }

  function getLuminance(hex: string): number {
    const [r, g, b] = parseHexRGB(hex);
    const sRGB = [r, g, b].map((c) => {
      const normalized = c / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * sRGB[0]! + 0.7152 * sRGB[1]! + 0.0722 * sRGB[2]!;
  }

  function getTextColor(hex: string): string {
    return getLuminance(hex) > 0.5 ? "black" : "white";
  }

  function getAverageTextColor(colors: string[]): string {
    const validColors = colors.filter(c => /^#(?:[0-9A-F]{3}){1,2}$/i.test(c));
    if (validColors.length === 0)
      return "white";

    const totalLuminance = validColors.reduce((sum, color) => {
      return sum + getLuminance(color);
    }, 0);

    const averageLuminance = totalLuminance / validColors.length;

    return averageLuminance > 0.2 ? "black" : "white";
  }

  function getEventUserColors(
    event: CalendarEvent,
    options: {
      eventColor: string;
      useUserColors?: boolean;
      defaultColor: string;
    } = { eventColor: "#06b6d4", defaultColor: "#06b6d4" },
  ): string | string[] {
    const { eventColor, useUserColors = true, defaultColor } = options;

    if (useUserColors && event.users && event.users.length > 0) {
      const userColors = event.users
        .map(user => user.color)
        .filter(color => color && color !== null)
        .sort() as string[];

      if (userColors.length > 1) {
        return userColors;
      }
      else if (userColors.length === 1) {
        return userColors[0] || defaultColor;
      }
    }

    if (Array.isArray(event.color)) {
      return event.color;
    }

    return (typeof event.color === "string" ? event.color : null) || eventColor || defaultColor;
  }

  function combineEvents(events: CalendarEvent[]): CalendarEvent[] {
    const eventMap = new Map<string, CalendarEvent>();

    events.forEach((event) => {
      const startTime = parseStableDate(event.start).getTime();
      const endTime = parseStableDate(event.end).getTime();
      const key = `${event.title}-${startTime}-${endTime}-${event.location || ""}-${event.description || ""}`;

      if (eventMap.has(key)) {
        const existingEvent = eventMap.get(key)!;

        const existingUserIds = new Set(existingEvent.users?.map(u => u.id) || []);
        const newUsers = event.users?.filter(u => !existingUserIds.has(u.id)) || [];
        const allUsers = [...(existingEvent.users || []), ...newUsers];
        existingEvent.users = allUsers.sort((a, b) => a.id.localeCompare(b.id));

        existingEvent.color = getEventUserColors(existingEvent);
      }
      else {
        const newEvent = {
          ...event,
          color: getEventUserColors(event),
        };
        eventMap.set(key, newEvent);
      }
    });

    return Array.from(eventMap.values()).sort((a, b) => {
      return parseStableDate(a.start).getTime() - parseStableDate(b.start).getTime();
    });
  }

  function getEventColorClasses(
    color?: string | string[],
    spanningInfo?: {
      event?: CalendarEvent;
      currentDay?: Date;
      isFirstDay?: boolean;
      isLastDay?: boolean;
    },
  ): string | { style: string } {
    if (Array.isArray(color)) {
      if (color.length > 1) {
        let colorStops: string;

        if (spanningInfo && spanningInfo.event && spanningInfo.currentDay
          && !(spanningInfo.isFirstDay === true && spanningInfo.isLastDay === true)) {
          const eventStart = parseStableDate(spanningInfo.event.start);
          const eventEnd = parseStableDate(spanningInfo.event.end);

          const totalDays = Math.floor((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const dayDiff = Math.floor((spanningInfo.currentDay.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24));

          const daysPerColor = totalDays / color.length;

          const visibleColors: Array<{ color: string; start: number; end: number }> = [];

          if (totalDays === color.length) {
            const currentColor = color[dayDiff];
            const nextColor = color[dayDiff + 1];

            if (currentColor) {
              const baseSplit = 75;
              const dayOffset = dayDiff * 2;
              const adjustedSplit = Math.min(baseSplit + dayOffset, 100);

              visibleColors.push({
                color: currentColor,
                start: 0,
                end: nextColor ? adjustedSplit : 100,
              });
            }

            if (nextColor) {
              const baseSplit = 75;
              const dayOffset = dayDiff * 2;
              const adjustedSplit = Math.min(baseSplit + dayOffset, 100);

              visibleColors.push({
                color: nextColor,
                start: adjustedSplit,
                end: 100,
              });
            }
          }
          else {
            color.forEach((c, colorIndex) => {
              const colorStartDay = colorIndex * daysPerColor;
              const colorEndDay = (colorIndex + 1) * daysPerColor;

              if (colorStartDay <= dayDiff + 1 && colorEndDay >= dayDiff) {
                const dayStart = Math.max(0, colorStartDay - dayDiff);
                const dayEnd = Math.min(1, colorEndDay - dayDiff);

                visibleColors.push({
                  color: c,
                  start: dayStart * 100,
                  end: dayEnd * 100,
                });
              }
            });
          }

          const reversedColors = visibleColors.reverse();
          colorStops = reversedColors.map(({ color: c, start, end }) => {
            const lightenedColor = /^#(?:[0-9A-F]{3}){1,2}$/i.test(c) ? lightenColor(c, 0.4) : c;
            const flippedStart = 100 - end;
            const flippedEnd = 100 - start;
            return `${lightenedColor} ${flippedStart}%, ${lightenedColor} ${flippedEnd}%`;
          }).join(", ");
        }
        else {
          const stripeWidth = 100 / color.length;
          colorStops = color.map((c, index) => {
            const start = index * stripeWidth;
            const end = (index + 1) * stripeWidth;
            const lightenedColor = /^#(?:[0-9A-F]{3}){1,2}$/i.test(c) ? lightenColor(c, 0.4) : c;
            return `${lightenedColor} ${start}%, ${lightenedColor} ${end}%`;
          }).join(", ");
        }

        const textColor = getAverageTextColor(color);
        const shadowColor = textColor === "black" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";

        return {
          style: `background: linear-gradient(-45deg, ${colorStops}); color: ${textColor}; text-shadow: 0 1px 2px ${shadowColor};`,
        };
      }
      else if (color.length === 1) {
        const singleColor = color[0];
        if (singleColor && /^#(?:[0-9A-F]{3}){1,2}$/i.test(singleColor)) {
          const lightenedColor = lightenColor(singleColor, 0.4);
          const textColor = getTextColor(lightenedColor);
          const shadowColor = textColor === "black" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
          return { style: `background-color: ${lightenedColor}; color: ${textColor}; text-shadow: 0 1px 2px ${shadowColor};` };
        }
      }
    }

    if (typeof color === "string" && /^#(?:[0-9A-F]{3}){1,2}$/i.test(color)) {
      const lightenedColor = lightenColor(color, 0.4);
      const textColor = getTextColor(lightenedColor);
      const shadowColor = textColor === "black" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
      return { style: `background-color: ${lightenedColor}; color: ${textColor}; text-shadow: 0 1px 2px ${shadowColor};` };
    }

    return "bg-secondary/20 hover:bg-secondary/30 text-elevated shadow-elevated/8 backdrop-blur-[2px]";
  }

  return {
    parseHexRGB,
    lightenColor,
    getLuminance,
    getTextColor,
    getAverageTextColor,
    getEventUserColors,
    combineEvents,
    getEventColorClasses,
  };
}
