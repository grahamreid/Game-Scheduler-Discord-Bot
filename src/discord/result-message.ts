/** Formats session details and vote totals shared by Discord announcements. */
import { escapeMarkdown } from "discord.js";
import type { ActivityTotals } from "../activity-result-workflow";

/** Formats the venue, any host, and the attendee list. */
export function formatSessionDetails(host: string | null, attendingUserIds: string[]): string {
  const venue = host === "virtual" ? "Virtual" : "In person";
  const hostLine = host === "virtual" || host === null ? [] : [`Host: <@${host}>`];
  const attendees = attendingUserIds.map((userId) => `<@${userId}>`).join(", ") || "none";
  return [`Venue: **${venue}**`, ...hostLine, `Attending: ${attendees}`].join("\n");
}

/** Formats the current activity tally as part of a Discord message. */
export function formatActivityTotals(totals: ActivityTotals): string {
  const heading = totals.ballotCount === totals.attendeeCount ? "Activity vote totals" : "Activity vote totals so far";
  return [
    `**${heading}**`,
    `Ballots received: ${totals.ballotCount}/${totals.attendeeCount}.`,
    ...totals.activityTallies.map(({ name, votes }) => `- ${escapeMarkdown(name)} — ${votes} ${votes === 1 ? "vote" : "votes"}`),
    "Use these totals to discuss what to play.",
  ].join("\n");
}
