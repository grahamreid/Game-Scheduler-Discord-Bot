/** Posts complete activity totals once all eligible attendees have voted. */
import { escapeMarkdown, type Client } from "discord.js";
import { getPollResults } from "../activity-result-workflow";
import { findUnpublishedActivityPoll, markActivityResultsPublished } from "../db/activity-polls";
import { findPlanningRound } from "../db/planning-rounds";
import { formatActivityTotals } from "./result-message";

export async function announceActivityResultsIfReady(client: Client, roundId: string): Promise<void> {
  const poll = await findUnpublishedActivityPoll(roundId);
  if (poll === null) return;

  const totals = await getPollResults(poll);
  if (totals.ballotCount !== totals.attendeeCount) return;

  const round = (await findPlanningRound(roundId))!;
  const channel = await client.channels.fetch(round.channelId);
  if (channel === null || !channel.isSendable()) {
    throw new Error(`Activity results have no sendable Discord channel: ${round.channelId}.`);
  }
  const title = round.title ?? "Board-game Scheduling";
  await channel.send({
    content: `**${escapeMarkdown(title)}**\nEvent date: **${round.eventDate}**\nEveryone attending has submitted an activity ballot.\n\n${formatActivityTotals(totals)}`,
    allowedMentions: { parse: [] },
  });
  await markActivityResultsPublished(roundId, new Date());
  console.log(`Activity vote results announced for round ${roundId}.`);
}
