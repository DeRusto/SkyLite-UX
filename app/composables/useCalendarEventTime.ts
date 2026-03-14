export function useCalendarEventTime() {
  function to12Hour(hour24: number): { hour: number; amPm: string } {
    if (hour24 === 0) {
      return { hour: 12, amPm: "AM" };
    }
    if (hour24 === 12) {
      return { hour: 12, amPm: "PM" };
    }
    if (hour24 > 12) {
      return { hour: hour24 - 12, amPm: "PM" };
    }
    return { hour: hour24, amPm: "AM" };
  }

  function to24Hour(hour12: number, amPm: string): number {
    if (amPm === "PM" && hour12 !== 12) {
      return hour12 + 12;
    }
    if (amPm === "AM" && hour12 === 12) {
      return 0;
    }
    return hour12;
  }

  function getRoundedCurrentTime(): { hour24: number; minutes: number } {
    const now = new Date();
    let minutes = Math.round(now.getMinutes() / 5) * 5;
    let hour24 = now.getHours();
    if (minutes === 60) {
      minutes = 0;
      hour24 = (hour24 + 1) % 24;
    }
    return { hour24, minutes };
  }

  function addMinutesTo12Hour(
    hour12: number,
    minute: number,
    amPm: string,
    minutesToAdd: number,
  ): { hour: number; minute: number; amPm: string } {
    let totalMinutes = minute + minutesToAdd;
    let hour24 = to24Hour(hour12, amPm);

    if (totalMinutes >= 60) {
      totalMinutes -= 60;
      hour24 += 1;
    }

    if (hour24 >= 24) {
      hour24 -= 24;
    }

    const result = to12Hour(hour24);
    return { hour: result.hour, minute: totalMinutes, amPm: result.amPm };
  }

  return { to12Hour, to24Hour, getRoundedCurrentTime, addMinutesTo12Hour };
}
