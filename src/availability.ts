/**
 * Availability-specific rules live here instead of the database file so they
 * can be read as plain business logic and reused by Discord and simulations.
 */
import type { AvailabilityResponse, AvailabilityTally, CandidateDate } from "./types";
import { appendAvailabilityResponse, findPlanningRound } from "./db/planning-rounds";

export type AvailabilityDecision =
  | { kind: "selected"; date: string; attendeeCount: number; tallies: AvailabilityTally[] }
  | { kind: "cancelled"; attendeeCount: number; tallies: AvailabilityTally[] };

/**
 * Tallies multi-select availability and determines the next workflow step.
 * A game night requires at least three available people. A tie selects the
 * chronologically earliest day, avoiding a second interaction round.
 */
export function decideAvailability(
  candidateDates: CandidateDate[],
  responses: AvailabilityResponse[],
): AvailabilityDecision {
  const talliesByDate = new Map(candidateDates.map((candidate) => [
    candidate.date,
    { date: candidate.date, votes: 0 },
  ]));
  for (const response of responses) {
    for (const date of response.dates) {
      const tally = talliesByDate.get(date);
      if (tally !== undefined) tally.votes += 1;
    }
  }

  const tallies = [...talliesByDate.values()];
  const attendeeCount = Math.max(0, ...tallies.map((tally) => tally.votes));
  if (attendeeCount < 3) return { kind: "cancelled", attendeeCount, tallies };

  const winner = tallies
    .filter((tally) => tally.votes === attendeeCount)
    .sort((left, right) => left.date.localeCompare(right.date))[0];
  return {
    kind: "selected",
    date: winner.date,
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
  dates: string[],
  now = new Date(),
): Promise<void> {
  const round = await findPlanningRound(roundId);
  if (round === null) throw new Error("Planning round not found.");
  if (round.status !== "open" || round.deadlineProcessedAt !== null || now >= round.deadline) {
    throw new Error("Availability is no longer open for this round.");
  }

  const allowedDates = new Set(round.candidateDates.map((candidate) => candidate.date));
  const uniqueSelections = new Set(dates);
  if (uniqueSelections.size !== dates.length || [...uniqueSelections].some((date) => !allowedDates.has(date))) {
    throw new Error("Availability contains an invalid candidate date.");
  }
  if (round.availabilityResponses.some((response) => response.userId === userId)) {
    throw new Error("This member has already submitted availability for this round.");
  }
  const saved = await appendAvailabilityResponse(roundId, { userId, dates, submittedAt: now });
  if (!saved) throw new Error("Availability is no longer open or was already submitted.");
}
