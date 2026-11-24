/**
 * Availability-specific rules live here instead of the database file so they
 * can be read as plain business logic and reused by Discord and simulations.
 */
import type { AvailabilityResponse, AvailabilityTally, CandidateSlot } from "./types";
import { appendAvailabilityResponse, findPlanningRound } from "./db/planning-rounds";

export type AvailabilityDecision =
  | { kind: "selected"; slot: string; attendeeCount: number; tallies: AvailabilityTally[] }
  | { kind: "cancelled"; attendeeCount: number; tallies: AvailabilityTally[] };

/**
 * Tallies multi-select availability and determines the next workflow step.
 * A game night requires at least three available people. A tie selects the
 * alphabetically first slot, avoiding a second interaction round.
 */
export function decideAvailability(
  candidateSlots: CandidateSlot[],
  responses: AvailabilityResponse[],
): AvailabilityDecision {
  const talliesBySlot = new Map(candidateSlots.map((candidate) => [
    candidate.value,
    { slot: candidate.value, votes: 0 },
  ]));
  for (const response of responses) {
    for (const slot of response.slots) {
      const tally = talliesBySlot.get(slot);
      if (tally !== undefined) tally.votes += 1;
    }
  }

  const tallies = [...talliesBySlot.values()];
  const attendeeCount = Math.max(0, ...tallies.map((tally) => tally.votes));
  if (attendeeCount < 3) return { kind: "cancelled", attendeeCount, tallies };

  const winner = tallies
    .filter((tally) => tally.votes === attendeeCount)
    .sort((left, right) => left.slot.localeCompare(right.slot))[0];
  return {
    kind: "selected",
    slot: winner.slot,
    attendeeCount,
    tallies,
  };
}

/**
 * Records one immutable multi-select response after verifying the round is
 * still accepting availability and every selected option belongs to that round.
 */
export async function submitAvailability(
  roundId: string,
  userId: string,
  slots: string[],
  now = new Date(),
): Promise<void> {
  const round = await findPlanningRound(roundId);
  if (round === null) throw new Error("Planning round not found.");
  if (round.status !== "open" || round.deadlineProcessedAt !== null || now >= round.deadline) {
    throw new Error("Availability is no longer open for this round.");
  }

  const allowedSlots = new Set(round.candidateSlots.map((candidate) => candidate.value));
  const uniqueSelections = new Set(slots);
  if (uniqueSelections.size !== slots.length || [...uniqueSelections].some((slot) => !allowedSlots.has(slot))) {
    throw new Error("Availability contains an invalid slot.");
  }
  if (round.availabilityResponses.some((response) => response.userId === userId)) {
    throw new Error("This member has already submitted availability for this round.");
  }
  const saved = await appendAvailabilityResponse(roundId, { userId, slots, submittedAt: now });
  if (!saved) throw new Error("Availability is no longer open or was already submitted.");
}
