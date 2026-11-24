/**
 * Coordinates availability closing with the data needed for a result message.
 * It has no Discord dependency, so local timers and future production triggers
 * use the same workflow while Discord rendering remains in the interaction layer.
 */
import type { AvailabilityDecision } from "./availability";
import { findAvailabilityResponses } from "./db/availability-responses";
import { findPlanningRound } from "./db/planning-rounds";
import { closeExpiredRounds } from "./scheduling/close-round";

/** A completed availability result, ready for a Discord-specific announcer to render. */
export interface AvailabilityClosureResult {
  guildId: string;
  channelId: string;
  title: string | null;
  minimumAttendeeCount: number;
  decision: AvailabilityDecision;
  /** Members available for the winning slot; empty when the round was cancelled. */
  attendingUserIds: string[];
}

/** Closes expired polls and returns only outcomes this process successfully applied. */
export async function closeExpiredRoundsAndPrepareResults(now = new Date()): Promise<AvailabilityClosureResult[]> {
  const closingResults = await closeExpiredRounds(now);
  const preparedResults: AvailabilityClosureResult[] = [];

  for (const closingResult of closingResults) {
    if (!closingResult.closedByThisRun) continue;
    const round = await findPlanningRound(closingResult.roundId);
    if (round === null) continue;
    const responses = await findAvailabilityResponses(round._id);
    let attendingUserIds: string[] = [];
    if (closingResult.decision.kind === "selected") {
      const selectedSlot = closingResult.decision.slot;
      attendingUserIds = responses
        .filter((response) => response.slots.includes(selectedSlot))
        .map((response) => response.userId);
    }
    preparedResults.push({
      guildId: round.guildId,
      channelId: round.channelId,
      title: round.title,
      minimumAttendeeCount: round.minimumAttendeeCount,
      decision: closingResult.decision,
      attendingUserIds,
    });
  }
  return preparedResults;
}
