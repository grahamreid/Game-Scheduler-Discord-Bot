/**
 * Direct MongoDB access for the planning-round document. It stays separate
 * from availability rules because this file owns persistence mechanics only.
 */
import type { Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import type { CandidateSlot, PlanningRound } from "../types";
import { getDatabase } from "./mongo";

/** The data supplied when opening a planning round. */
export interface CreatePlanningRoundInput {
  guildId: string;
  channelId: string;
  title?: string;
  deadline: Date;
  slots: string[];
}

/** Candidate slots are embedded because they only exist within one round. */
export interface PlanningRoundDocument extends PlanningRound {
  candidateSlots: CandidateSlot[];
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

/** Creates an open round and stores its alphabetically ordered candidate slots. */
export async function createPlanningRound(input: CreatePlanningRoundInput): Promise<PlanningRoundDocument> {
  if (new Set(input.slots).size !== input.slots.length) {
    throw new Error("Slots must be unique within a round.");
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
    selectedSlot: null,
    selectedHostUserId: null,
    finalizedAt: null,
    createdAt: now,
    updatedAt: now,
    candidateSlots: [...input.slots]
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value })),
  };
  await (await rounds()).insertOne(round);
  return round;
}

/** Looks up a round by its ID, or returns null when it is absent. */
export async function findPlanningRound(id: string): Promise<PlanningRoundDocument | null> {
  const round = await (await rounds()).findOne({ _id: id });
  return round;
}

/** Finds the one current round for a guild, if that guild is planning one. */
export async function findOpenPlanningRound(guildId: string): Promise<PlanningRoundDocument | null> {
  return (await rounds()).findOne({ guildId, status: "open" }, { sort: { createdAt: -1 } });
}

/**
 * Removes every round belonging to one guild and its dependent availability
 * responses. Call this only after an administrator has explicitly confirmed.
 */
export async function wipeGuildRounds(guildId: string): Promise<number> {
  const planningRounds = await rounds();
  // "projection" here fetches only IDs (_id): availability responses refer to a round ID, not its full document.
  const guildRounds = await planningRounds.find({ guildId }, { projection: { _id: 1 } }).toArray();
  const roundIds = guildRounds.map((round) => round._id);
  if (roundIds.length > 0) {
    await (await getDatabase()).collection("availabilityResponses").deleteMany({ roundId: { $in: roundIds } });
  }
  const result = await planningRounds.deleteMany({ guildId });
  return result.deletedCount;
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
export async function selectAvailabilitySlot(
  roundId: string,
  slot: string,
  closedAt: Date,
): Promise<boolean> {
  const result = await (await rounds()).updateOne(
    { _id: roundId, status: "open", deadlineProcessedAt: null },
    { $set: { selectedSlot: slot, deadlineProcessedAt: closedAt, updatedAt: closedAt } },
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
