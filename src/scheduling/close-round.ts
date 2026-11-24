/**
 * Closes availability for planning rounds. The reusable single-round function
 * is separate from the expired-round loop so a future Discord action or job
 * can close one specific round without pretending it is a deadline scheduler.
 */
import { determineWinningSlot, type AvailabilityDecision } from "../availability";
import { findAvailabilityResponses } from "../db/availability-responses";
import {
  cancelForInsufficientAvailability,
  findExpiredRounds,
  selectAvailabilitySlot,
  type PlanningRoundDocument,
} from "../db/planning-rounds";

export interface RoundClosingResult {
  roundId: string;
  decision: AvailabilityDecision;
  applied: boolean;
}

/** Determines and persists the availability outcome for one open round. */
export async function closeRound(round: PlanningRoundDocument, closedAt = new Date()): Promise<RoundClosingResult> {
  const responses = await findAvailabilityResponses(round._id);
  const decision = determineWinningSlot(round.candidateSlots, responses);
  const applied = decision.kind === "selected"
    ? await selectAvailabilitySlot(round._id, decision.slot, closedAt)
    : await cancelForInsufficientAvailability(round._id, closedAt);
  return { roundId: round._id, decision, applied };
}

/** Closes every round whose configured deadline has passed. Safe to call repeatedly. */
export async function closeExpiredRounds(now = new Date()): Promise<RoundClosingResult[]> {
  const expiredRounds = await findExpiredRounds(now);
  const results: RoundClosingResult[] = [];
  for (const round of expiredRounds) {
    results.push(await closeRound(round, now));
  }
  return results;
}
