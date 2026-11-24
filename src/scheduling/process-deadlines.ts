/**
 * Advances expired planning rounds. This is separate from the CLI script so
 * the same workflow can later be called by a cron job, Lambda, or Discord app.
 */
import { decideAvailability, type AvailabilityDecision } from "../availability";
import {
  cancelForInsufficientAvailability,
  findExpiredRounds,
  selectAvailabilitySlot,
} from "../db/planning-rounds";

export interface DeadlineProcessingResult {
  roundId: string;
  decision: AvailabilityDecision;
  applied: boolean;
}

/** Advances every round whose deadline has passed. Safe to call repeatedly. */
export async function processDeadlines(now = new Date()): Promise<DeadlineProcessingResult[]> {
  const expiredRounds = await findExpiredRounds(now);
  const results: DeadlineProcessingResult[] = [];

  for (const round of expiredRounds) {
    const decision = decideAvailability(round.candidateSlots, round.availabilityResponses);
    const applied = decision.kind === "selected"
      ? await selectAvailabilitySlot(round._id, decision.slot, now)
      : await cancelForInsufficientAvailability(round._id, now);
    results.push({ roundId: round._id, decision, applied });
  }
  return results;
}
