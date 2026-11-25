/**
 * Coordinates availability closing with the data needed for a result message.
 * It has no Discord dependency, so local timers and future production triggers
 * use the same workflow while Discord rendering remains in the interaction layer.
 */
import type { AvailabilityDecision } from "./availability";
import { prepareActivityPoll, type ActivityPollChoices } from "./activity-voting";
import { findPlanningRound } from "./db/planning-rounds";
import { closeExpiredRounds } from "./scheduling/close-round";

/** A completed availability result, ready for a Discord-specific announcer to render. */
export interface AvailabilityClosureResult {
  guildId: string;
  channelId: string;
  title: string | null;
  minimumAttendeeCount: number;
  decision: AvailabilityDecision;
  host: string | null;
  /** Members available for the winning slot; empty when the round was cancelled. */
  attendingUserIds: string[];
  activityPoll: ActivityPollChoices | null;
}

/** Closes expired polls and returns only outcomes this process successfully applied. */
export async function closeExpiredRoundsAndPrepareResults(now = new Date()): Promise<AvailabilityClosureResult[]> {
  const closingResults = await closeExpiredRounds(now);
  const preparedResults: AvailabilityClosureResult[] = [];

  for (const closingResult of closingResults) {
    if (!closingResult.closedByThisRun) continue;
    const round = await findPlanningRound(closingResult.roundId);
    if (round === null) continue;
    const { attendingUserIds } = closingResult;
    const activityPoll = closingResult.decision.kind === "selected"
      ? await prepareActivityPoll(round._id, round.guildId, attendingUserIds, now)
      : null;
    preparedResults.push({
      guildId: round.guildId,
      channelId: round.channelId,
      title: round.title,
      minimumAttendeeCount: round.minimumAttendeeCount,
      decision: closingResult.decision,
      host: round.host,
      attendingUserIds,
      activityPoll,
    });
  }
  return preparedResults;
}
