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
  finalizePlanningRound,
  type PlanningRoundDocument,
} from "../db/planning-rounds";

export interface RoundClosingResult {
  roundId: string;
  decision: AvailabilityDecision;
  attendingUserIds: string[];
  /** True only when this process successfully persisted the availability closure. */
  closedByThisRun: boolean;
}

/** Determines and persists the availability outcome for one open round. */
export async function closeRound(round: PlanningRoundDocument, closedAt = new Date()): Promise<RoundClosingResult> {
  const responses = await findAvailabilityResponses(round._id);
  // Old local rounds predate configurable thresholds; retain the original
  // three-person behavior for them instead of accidentally accepting zero.
  const minimumAttendeeCount = Number.isSafeInteger(round.minimumAttendeeCount) && round.minimumAttendeeCount > 0
    ? round.minimumAttendeeCount
    : 3;
  const decision = determineWinningSlot(round.candidateSlots, responses, minimumAttendeeCount);
  if (decision.kind === "cancelled") {
    const closedByThisRun = await cancelForInsufficientAvailability(round._id, closedAt);
    return { roundId: round._id, decision, attendingUserIds: [], closedByThisRun };
  }

  const selectedSlot = decision.slot;
  const attendingUserIds = responses
    .filter(({ slots }) => slots.includes(selectedSlot))
    .map(({ userId }) => userId);
  const isVirtual = round.venuePolicy === "either"
    && attendingUserIds.some((userId) => round.virtualPreferenceUserIds.includes(userId));
  const host = isVirtual ? "virtual" : "in-person";
  const closedByThisRun = await finalizePlanningRound(round._id, selectedSlot, host, closedAt);
  return { roundId: round._id, decision, attendingUserIds, closedByThisRun };
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
