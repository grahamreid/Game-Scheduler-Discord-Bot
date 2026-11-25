/**
 * Turns completed round-closure results into Discord messages. It stays in the
 * Discord layer because formatting user mentions and sending a channel message
 * are Discord-specific presentation concerns.
 */
import type { Client } from "discord.js";
import type { AvailabilityClosureResult } from "../round-result-workflow";
import { buildActivityPollMessage } from "./activity-poll";

/** Posts every current result prepared by the round-closure application workflow. */
export async function announceRoundClosures(
  client: Client,
  results: AvailabilityClosureResult[],
): Promise<void> {
  for (const result of results) {
    const channel = await client.channels.fetch(result.channelId);
    if (channel === null || !channel.isSendable()) {
      throw new Error(`Round result has no sendable Discord channel: ${result.channelId}.`);
    }
    const title = result.title ?? "Board-game Scheduling";
    const content = result.decision.kind === "selected"
      ? `**${title}** availability has closed.\nSelected slot: **${result.decision.slot}**\nAttending: ${attendeeMentions(result.attendingUserIds)}`
      : `**${title}** availability has closed.\nNo slot reached the required ${result.minimumAttendeeCount} attendees (highest: ${result.decision.attendeeCount}). This round has been cancelled.`;
    await channel.send({
      content,
      // Explicitly permit mentions for attendees only; no broad role or @everyone mentions.
      allowedMentions: { users: result.attendingUserIds },
    });
    if (result.activityPoll !== null) await channel.send(buildActivityPollMessage(result.activityPoll));
  }
}

/** Produces Discord user-mention markup for members available on the winning slot. */
function attendeeMentions(userIds: string[]): string {
  return userIds.map((userId) => `<@${userId}>`).join(", ") || "none";
}
