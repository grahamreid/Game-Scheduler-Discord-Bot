/**
 * Handles calendar dates for availability slots and activity polls. Manual
 * round creation and future recurring automation share these rules.
 */
import type { RoundCadence } from "./types";

/** Returns the local calendar date in the supplied timezone as YYYY-MM-DD. */
export function getLocalCalendarDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}

/** Converts the supported cadence names into their fixed MVP day spans. */
export function daysForCadence(cadence: RoundCadence): number {
  return cadence === "weekly" ? 7 : 14;
}

/**
 * Generates slots from the first Monday strictly after the scheduled survey
 * date. Weekdays have one evening-implied slot; weekends optionally get an
 * Afternoon and Evening slot. Date-first text keeps lexical sorting chronological.
 */
export function generateRoundSlots(
  scheduledSurveyDate: Date,
  daysAhead: number,
  splitWeekendSlots: boolean,
): string[] {
  const firstMonday = new Date(scheduledSurveyDate);
  firstMonday.setHours(0, 0, 0, 0);
  // JavaScript numbers weekdays Sunday=0 through Saturday=6. Subtracting the
  // current weekday from 8 gives days until Monday: Sunday -> 1, Tuesday -> 6.
  // On Monday the modulo result is 0, so `|| 7` deliberately selects the next
  // Monday rather than allowing the scheduled survey day itself as a slot.
  const daysUntilNextMonday = (8 - firstMonday.getDay()) % 7 || 7;
  firstMonday.setDate(firstMonday.getDate() + daysUntilNextMonday);

  const slots: string[] = [];
  for (let offset = 0; offset < daysAhead; offset += 1) {
    const date = new Date(firstMonday);
    date.setDate(firstMonday.getDate() + offset);
    const dateText = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    if (splitWeekendSlots && (weekday === "Saturday" || weekday === "Sunday")) {
      slots.push(`${dateText} (${weekday} Afternoon)`, `${dateText} (${weekday} Evening)`);
    } else {
      slots.push(`${dateText} (${weekday})`);
    }
  }
  return slots;
}
