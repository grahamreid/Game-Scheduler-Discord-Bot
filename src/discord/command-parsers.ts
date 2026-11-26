/**
 * Validates and normalizes slash-command text. This stays separate from
 * handlers so commands read as workflow code instead of parsing details.
 */
import { ianaTimeZoneByAbbreviation } from "./constants";
import type { RoundCadence } from "../types";

/** Converts a positive duration such as 1h into its deadline instant. */
export function parseDeadline(value: string): Date {
  const match = /^(\d+)(m|h|d)$/i.exec(value.trim());
  if (match === null) throw new Error("Deadline must be a duration such as 1m, 1h, or 1d.");
  const amount = Number(match[1]);
  const unitMilliseconds = { m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase() as "m" | "h" | "d"];
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Deadline duration must be a positive whole number.");
  }
  return new Date(Date.now() + amount * unitMilliseconds);
}

/** Narrows a Discord option to a supported scheduling cadence. */
export function parseCadence(value: string): RoundCadence {
  if (value === "weekly" || value === "biweekly") return value;
  throw new Error("Cadence must be weekly or biweekly.");
}

/** Validates a date-only command value without a timezone conversion. */
export function parseCalendarDate(value: string, fieldName: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) throw new Error(`${fieldName} must use YYYY-MM-DD.`);
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`${fieldName} must be a real calendar date.`);
  }
  return value;
}

/** Parses friendly local time text and maps its common US abbreviation to an IANA zone. */
export function parseSurveyLaunchTime(value: string): { time: string; timeZone: string } {
  const normalized = value.trim();
  const match = /^(.*?)\s+([A-Z]{2,5})$/i.exec(normalized);
  if (match === null) {
    throw new Error("Survey launch time must include a time and timezone abbreviation, such as 5:00 PM ET.");
  }
  const [, time, abbreviation] = match;
  const isTwelveHourTime = /^(?:[1-9]|1[0-2]):[0-5]\d\s?(?:AM|PM)$/i.test(time);
  const isTwentyFourHourTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!isTwelveHourTime && !isTwentyFourHourTime) {
    throw new Error("Survey launch time must use a time such as 5:00 PM or 17:00.");
  }
  const timeZone = ianaTimeZoneByAbbreviation[abbreviation.toUpperCase()];
  if (timeZone === undefined) {
    throw new Error("Use a supported US timezone abbreviation: ET, CT, MT, PT, or their standard/daylight variants.");
  }
  return { time, timeZone };
}
