/**
 * Shared fixed values for Discord interactions. Keeping IDs and mappings here
 * prevents handlers from relying on duplicated string literals.
 */
export const availabilityCustomIdPrefix = "availability:";
export const wipeConfirmPrefix = "round-wipe-confirm:";
export const wipeCancelPrefix = "round-wipe-cancel:";

/** Maps common US abbreviations, including DST variants, to scheduler-ready IANA zones. */
export const ianaTimeZoneByAbbreviation: Record<string, string> = {
  ET: "America/New_York",
  EST: "America/New_York",
  EDT: "America/New_York",
  CT: "America/Chicago",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  MT: "America/Denver",
  MST: "America/Denver",
  MDT: "America/Denver",
  PT: "America/Los_Angeles",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
};
