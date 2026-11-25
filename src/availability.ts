/**
 * Availability-specific rules live here instead of the database file so they
 * can be read as plain business logic and reused by Discord handlers and future tests.
 */
import { saveAvailabilityResponse } from "./db/availability-responses";
import { findPlanningRound } from "./db/planning-rounds";
import type { AvailabilityResponse, AvailabilityTally, CandidateSlot, PlanningRound } from "./types";

export type AvailabilityDecision =
  | { kind: "selected"; slot: string; attendeeCount: number; tallies: AvailabilityTally[] }
  | { kind: "cancelled"; attendeeCount: number; tallies: AvailabilityTally[] };

/** Checks whether the initial poll still accepts availability and suggestions. */
export function isInitialPollOpen(round: PlanningRound, now = new Date()): boolean {
  return round.status === "open";
}

/** Counts the selections for each candidate slot. */
export function tallyAvailability(
  candidateSlots: CandidateSlot[],
  responses: AvailabilityResponse[],
): AvailabilityTally[] {
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

  return [...talliesBySlot.values()];
}

/**
 * Selects the most popular slot if it meets the minimum attendee count.
 * A tie selects the alphabetically first slot.
 */
export function determineWinningSlot(
  candidateSlots: CandidateSlot[],
  responses: AvailabilityResponse[],
  minimumAttendeeCount: number,
): AvailabilityDecision {
  const tallies = tallyAvailability(candidateSlots, responses);
  const attendeeCount = Math.max(0, ...tallies.map((tally) => tally.votes));
  if (attendeeCount < minimumAttendeeCount) return { kind: "cancelled", attendeeCount, tallies };

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
 * Saves a member's current multi-select response after verifying the round is
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
  if (!isInitialPollOpen(round, now)) {
    throw new Error("Availability is no longer open for this round.");
  }

  const allowedSlots = new Set(round.candidateSlots.map((candidate) => candidate.value));
  const uniqueSelections = new Set(slots);
  if (uniqueSelections.size !== slots.length || [...uniqueSelections].some((slot) => !allowedSlots.has(slot))) {
    throw new Error("Availability contains an invalid slot.");
  }
  await saveAvailabilityResponse({ roundId, userId, slots, submittedAt: now });
}
