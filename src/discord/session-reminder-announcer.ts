/** Posts due session reminders with their current activity totals in the original channel. */
import { escapeMarkdown, type Client } from "discord.js";
import { markRoundReminderSent } from "../db/planning-rounds";
import { getDueSessionReminders } from "../session-reminder-workflow";
import { formatActivityTotals, formatSessionDetails } from "./result-message";

/** Posts each reminder once per scheduled event date. */
export async function announceDueSessionReminders(client: Client): Promise<void> {
  const reminders = await getDueSessionReminders();
  for (const { round, eventDate, attendingUserIds, activityTotals } of reminders) {
    try {
      const channel = await client.channels.fetch(round.channelId);
      if (channel === null || !channel.isSendable()) {
        throw new Error(`Session reminder has no sendable Discord channel: ${round.channelId}.`);
      }

      const title = round.title ?? "Board-game Scheduling";
      const timeOfDay = / (Afternoon|Evening)\)$/.exec(round.selectedSlot!)?.[1];
      const eventLabel = timeOfDay === undefined ? eventDate : `${eventDate} (${timeOfDay})`;
      await channel.send({
        content: [
          `**${escapeMarkdown(title)} — session reminder**`,
          `Event date: **${eventLabel}**`,
          formatSessionDetails(round.host, attendingUserIds),
          ...(activityTotals === null ? [] : ["", formatActivityTotals(activityTotals)]),
        ].join("\n"),
        allowedMentions: { parse: [], users: attendingUserIds },
      });
      await markRoundReminderSent(round._id, eventDate);
    } catch (error) {
      console.error(`Could not announce the session reminder for round ${round._id}:`, error);
    }
  }
}
