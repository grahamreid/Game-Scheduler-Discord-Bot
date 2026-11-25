/** Sends activity-vote snapshots when the publication trigger has arrived. */
import { escapeMarkdown, type Client } from "discord.js";
import { getPollResultsIfReady } from "../activity-result-workflow";
import { markActivityResultsPublished } from "../db/activity-polls";

// Keep overlapping ballot and timer triggers from posting the same result twice in this bot process.
const publishingRoundIds = new Set<string>();

/** Publishes ready activity totals; failed sends remain eligible for a later retry. */
export async function announceReadyActivityResults(
  client: Client,
  roundId?: string,
): Promise<void> {
  const dueResults = await getPollResultsIfReady(roundId);

  for (const result of dueResults) {
    if (publishingRoundIds.has(result.roundId)) continue;
    publishingRoundIds.add(result.roundId);
    
    try {
      const channel = await client.channels.fetch(result.channelId);
      if (channel === null || !channel.isSendable()) {
        throw new Error(`Activity results have no sendable Discord channel: ${result.channelId}.`);
      }
      const title = result.title ?? "Board-game Scheduling";
      const publicationReason = result.allAttendeesVoted
        ? "Everyone attending has submitted an activity ballot."
        : "The day-before-results cutoff has arrived.";
      const tallyLines = result.activityTallies.map(({ name, votes }) =>
        `- ${escapeMarkdown(name)} — ${votes} ${votes === 1 ? "vote" : "votes"}`,
      );
      await channel.send({
        content: [
          `**${escapeMarkdown(title)} — activity vote totals**`,
          `Event date: **${result.eventDate}**`,
          publicationReason,
          `Ballots received: ${result.ballotCount}/${result.attendeeCount}.`,
          ...tallyLines,
          "These totals are for discussion, not a binding game choice. Ballots can still be changed through the event date; this announcement is a snapshot.",
        ].join("\n"),
      });
      await markActivityResultsPublished(result.roundId, new Date());
      console.log(`Activity vote results announced for round ${result.roundId}.`);
    } catch (error) {
      console.error(`Could not announce activity vote results for round ${result.roundId}:`, error);
    } finally {
      publishingRoundIds.delete(result.roundId);
    }
  }
}
