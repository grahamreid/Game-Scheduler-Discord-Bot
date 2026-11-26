/**
 * Closes availability for planning rounds. The reusable single-round function
 * is separate from the expired-round loop so a future Discord action or job
 * can close one specific round without pretending it is a deadline scheduler.
 */
import { determineWinningSlot, type AvailabilityDecision } from "../availability";
import { findAvailabilityResponses } from "../db/availability-responses";
import {
  cancelForInsufficientAvailability,
  finalizePlanningRound,
  findExpiredRounds,
  findLastHostedDates,
  type PlanningRoundDocument,
} from "../db/planning-rounds";

export interface RoundClosingResult {
  roundId: string;
  decision: AvailabilityDecision;
  attendingUserIds: string[];
  /** True only when this process successfully persisted the availability closure. */
  closedSuccessfully: boolean;
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
    const closedSuccessfully = await cancelForInsufficientAvailability(round._id, closedAt);
    return { roundId: round._id, decision, attendingUserIds: [], closedSuccessfully };
  }

  const selectedSlot = decision.slot;
  const attendees = responses.filter(({ slots }) => slots.includes(selectedSlot));
  const attendingUserIds = attendees.map(({ userId }) => userId);
  const isVirtual = round.venuePolicy === "either"
    && attendingUserIds.some((userId) => round.virtualPreferenceUserIds.includes(userId));
  // Every generated slot starts with its YYYY-MM-DD calendar date.
  const eventDate = selectedSlot.slice(0, 10);
  const volunteerIds = attendees.filter(({ canHost }) => canHost === true).map(({ userId }) => userId);
  const host = isVirtual ? "virtual" : await chooseInPersonHost(round.guildId, volunteerIds, eventDate);
  const closedSuccessfully = await finalizePlanningRound(round._id, selectedSlot, eventDate, host, closedAt);
  return { roundId: round._id, decision, attendingUserIds, closedSuccessfully };
}

/** Gives first-time hosts priority, then orders volunteers by least recent hosting date. */
async function chooseInPersonHost(guildId: string, volunteerIds: string[], eventDate: string): Promise<string | null> {
  if (volunteerIds.length === 0) return null;
  if (volunteerIds.length === 1) return volunteerIds[0];

  // gets the latest host date per volunteer, then whichever of those was longest ago is the decided host
  const lastHostedDates = await findLastHostedDates(guildId, volunteerIds, eventDate);
  volunteerIds.sort((left, right) => {
    // if volunteer has never hosted, empty string => sorts to the front to make sure new hosts get priority
    const leftDate = lastHostedDates.get(left) ?? "";
    const rightDate = lastHostedDates.get(right) ?? "";
    return leftDate.localeCompare(rightDate) || left.localeCompare(right);
  });
  return volunteerIds[0];
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
