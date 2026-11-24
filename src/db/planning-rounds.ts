/**
 * Direct MongoDB access for the planning-round document. It stays separate
 * from availability rules because this file owns persistence mechanics only.
 */
import type { Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import type { AvailabilityResponse, CandidateDate, PlanningRound } from "../types";
import { getDatabase } from "./mongo";

/** The data supplied when opening a planning round. */
export interface CreatePlanningRoundInput {
  guildId: string;
  channelId: string;
  title?: string;
  deadline: Date;
  candidateDates: string[];
}

/** Candidate dates are embedded because they only exist within one round. */
export interface PlanningRoundDocument extends PlanningRound {
  candidateDates: CandidateDate[];
}

async function rounds(): Promise<Collection<PlanningRoundDocument>> {
  return (await getDatabase()).collection<PlanningRoundDocument>("planningRounds");
}

/** Cancels any previous in-progress round for a guild before a newer one opens. */
async function cancelActiveRoundsForGuild(guildId: string, cancelledAt: Date): Promise<void> {
  await (await rounds()).updateMany(
    { guildId, status: "open" },
    { $set: { status: "cancelled", deadlineProcessedAt: cancelledAt, updatedAt: cancelledAt } },
  );
}

/** Creates an open round and assigns stable IDs to its candidate dates. */
export async function createPlanningRound(input: CreatePlanningRoundInput): Promise<PlanningRoundDocument> {
  if (new Set(input.candidateDates).size !== input.candidateDates.length) {
    throw new Error("Candidate dates must be unique within a round.");
  }
  const now = new Date();
  const id = randomUUID();
  await cancelActiveRoundsForGuild(input.guildId, now);
  const round: PlanningRoundDocument = {
    _id: id,
    guildId: input.guildId,
    channelId: input.channelId,
    status: "open",
    title: input.title ?? null,
    deadline: input.deadline,
    deadlineProcessedAt: null,
    availabilityResponses: [],
    selectedDate: null,
    selectedHostUserId: null,
    finalizedAt: null,
    createdAt: now,
    updatedAt: now,
    candidateDates: [...input.candidateDates]
      .sort((left, right) => left.localeCompare(right))
      .map((date) => ({ date })), // ["2026-12-04"] -> [{ date: "2026-12-04" }]
  };
  await (await rounds()).insertOne(round);
  return round;
}

/** Looks up a round by its ID, or returns null when it is absent. */
export async function findPlanningRound(id: string): Promise<PlanningRoundDocument | null> {
  const round = await (await rounds()).findOne({ _id: id });
  return round;
}

/** Adds one member's response if the round remains open and they have not already responded. */
export async function appendAvailabilityResponse(
  roundId: string,
  response: AvailabilityResponse,
): Promise<boolean> {
  const result = await (await rounds()).updateOne(
    {
      _id: roundId,
      status: "open",
      deadlineProcessedAt: null,
      deadline: { $gt: response.submittedAt },
      "availabilityResponses.userId": { $ne: response.userId },
    },
    { $push: { availabilityResponses: response } },
  );
  return result.modifiedCount === 1;
}

/** Finds open rounds whose deadline is ready to process. */
export async function findExpiredRounds(now: Date): Promise<PlanningRoundDocument[]> {
  return (await rounds()).find({
    status: "open",
    deadlineProcessedAt: null,
    deadline: { $lte: now },
  }).toArray();
}

/** Persists a decided availability day while leaving the overall round open. */
export async function selectAvailabilityDate(
  roundId: string,
  date: string,
  closedAt: Date,
): Promise<boolean> {
  const result = await (await rounds()).updateOne(
    { _id: roundId, status: "open", deadlineProcessedAt: null },
    { $set: { selectedDate: date, deadlineProcessedAt: closedAt, updatedAt: closedAt } },
  );
  return result.modifiedCount === 1;
}

/** Cancels a round when no candidate date reaches the three-person minimum. */
export async function cancelForInsufficientAvailability(roundId: string, closedAt: Date): Promise<boolean> {
  const result = await (await rounds()).updateOne(
    { _id: roundId, status: "open", deadlineProcessedAt: null },
    { $set: { status: "cancelled", deadlineProcessedAt: closedAt, updatedAt: closedAt } },
  );
  return result.modifiedCount === 1;
}
