/**
 * Direct MongoDB access for the planning-round document. It stays separate
 * from availability rules because this file owns persistence mechanics only.
 */
import type { Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import type { CandidateSlot, PlanningRound, VenuePreference } from "../types";
import { deleteGuildActivityPolls } from "./activity-polls";
import { findVirtualPreferenceUserIds } from "./member-preferences";
import { getDatabase } from "./mongo";

/** The data supplied when opening a planning round. */
export interface CreatePlanningRoundInput {
  guildId: string;
  channelId: string;
  title?: string;
  deadline: Date;
  minimumAttendeeCount: number;
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
    { $set: { status: "cancelled", updatedAt: cancelledAt } },
  );
}

/** Creates an open round and stores its alphabetically ordered candidate slots. */
export async function createPlanningRound(input: CreatePlanningRoundInput): Promise<PlanningRoundDocument> {
  if (new Set(input.slots).size !== input.slots.length) {
    throw new Error("Slots must be unique within a round.");
  }
  const planningRounds = await rounds();
  const [lastFinalizedRound, virtualPreferenceUserIds] = await Promise.all([
    planningRounds.findOne({ guildId: input.guildId, status: "finalized" }, { sort: { finalizedAt: -1 }, projection: { host: 1 } }),
    findVirtualPreferenceUserIds(input.guildId),
  ]);
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
    minimumAttendeeCount: input.minimumAttendeeCount,
    selectedSlot: null,
    eventDate: null,
    host: null,
    venuePolicy: lastFinalizedRound?.host === "virtual" ? "in-person" : "either",
    virtualPreferenceUserIds,
    finalizedAt: null,
    createdAt: now,
    updatedAt: now,
    candidateSlots: [...input.slots]
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({ value })),
  };
  await planningRounds.insertOne(round);
  return round;
}

/** Updates one member's preference for an open round that offers a choice. */
export async function setRoundVenuePreference(roundId: string, userId: string, venue: VenuePreference): Promise<boolean> {
  const result = await (await rounds()).updateOne(
    { _id: roundId, status: "open", venuePolicy: "either" },
    venue === "virtual"
      ? { $addToSet: { virtualPreferenceUserIds: userId } }
      : { $pull: { virtualPreferenceUserIds: userId } },
  );
  return result.matchedCount === 1;
}

/** Looks up a round by its ID, or returns null when it is absent. */
export async function findPlanningRound(id: string): Promise<PlanningRoundDocument | null> {
  const round = await (await rounds()).findOne({ _id: id });
  return round;
}

/**
 * Removes the guild's rounds and their responses, suggestions, polls, and ballots.
 * Call this only after an administrator has explicitly confirmed.
 */
export async function wipeGuildRounds(guildId: string): Promise<number> {
  const planningRounds = await rounds();
  // Only the IDs are needed to find the records attached to each round.
  const guildRounds = await planningRounds.find({ guildId }, { projection: { _id: 1 } }).toArray();
  const roundIds = guildRounds.map((round) => round._id);
  if (roundIds.length === 0) {
    await deleteGuildActivityPolls(guildId);
    return 0;
  }

  const database = await getDatabase();
  const roundIdFilter = { roundId: { $in: roundIds } };
  await Promise.all([
    database.collection("availabilityResponses").deleteMany(roundIdFilter),
    database.collection("activitySuggestions").deleteMany(roundIdFilter),
    database.collection("activityVotes").deleteMany(roundIdFilter),
  ]);

  const { deletedCount } = await planningRounds.deleteMany({ guildId, _id: { $in: roundIds } });
  // Delete polls after their rounds so this also catches polls saved during the wipe.
  await deleteGuildActivityPolls(guildId);
  return deletedCount;
}

/** Finds open rounds whose deadline is ready to process. */
export async function findExpiredRounds(now: Date): Promise<PlanningRoundDocument[]> {
  return (await rounds()).find({
    status: "open",
    deadline: { $lte: now },
  }).toArray();
}

/** Records the winning slot and host choice and finalizes the round in one write. */
export async function finalizePlanningRound(
  roundId: string,
  slot: string,
  host: string,
  closedAt: Date,
): Promise<boolean> {
  // Every generated slot starts with its YYYY-MM-DD calendar date.
  const eventDate = slot.slice(0, 10);
  const result = await (await rounds()).updateOne(
    { _id: roundId, status: "open" },
    { $set: { status: "finalized", selectedSlot: slot, eventDate, host, finalizedAt: closedAt, updatedAt: closedAt } },
  );
  return result.modifiedCount === 1;
}

/** Cancels a round when no candidate slot reaches its configured attendance minimum. */
export async function cancelForInsufficientAvailability(roundId: string, closedAt: Date): Promise<boolean> {
  const result = await (await rounds()).updateOne(
    { _id: roundId, status: "open" },
    { $set: { status: "cancelled", updatedAt: closedAt } },
  );
  return result.modifiedCount === 1;
}
