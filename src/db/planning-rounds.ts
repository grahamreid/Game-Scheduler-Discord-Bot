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

/** Finds the latest open round in this server for manual closure. */
export async function findOpenPlanningRound(guildId: string): Promise<PlanningRoundDocument | null> {
  return (await rounds()).findOne({ guildId, status: "open" }, { sort: { createdAt: -1 } });
}

/** Finds the last round created for a guild, regardless of its status. */
export async function findLatestPlanningRound(guildId: string): Promise<PlanningRoundDocument | null> {
  return (await rounds()).findOne({ guildId }, { sort: { createdAt: -1, _id: -1 } });
}

/** Changes the latest round's scheduled date if it has been finalized. */
export async function updateLatestRoundEventDate(
  guildId: string,
  eventDate: string,
): Promise<Pick<PlanningRoundDocument, "_id" | "eventDate"> | null> {
  const latestRound = await findLatestPlanningRound(guildId);
  if (latestRound === null) return null;
  return (await rounds()).findOneAndUpdate(
    { _id: latestRound._id, guildId, status: "finalized" },
    { $set: { eventDate, updatedAt: new Date() } },
    { projection: { _id: 1, eventDate: 1 }, returnDocument: "after" },
  );
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

/** Finds finalized sessions with no reminder for their current event date. */
export async function findRoundsAwaitingReminder(earliestEventDate: string): Promise<PlanningRoundDocument[]> {
  return (await rounds()).find({
    status: "finalized",
    eventDate: { $gte: earliestEventDate }, // check on whether too early to send reminder done elsewhere
    $expr: { $ne: [{ $ifNull: ["$reminderSentForDate", null] }, "$eventDate"] },
  }).toArray();
}

/** Records the reminder if its event date is still current. */
export async function markRoundReminderSent(roundId: string, eventDate: string): Promise<void> {
  await (await rounds()).updateOne({ _id: roundId, eventDate }, { $set: { reminderSentForDate: eventDate } });
}

/** Finds each volunteer's most recent hosting */
export async function findLastHostedDates(guildId: string, userIds: string[], eventDate: string): Promise<Map<string, string>> {
  const previousSessions = await (await rounds())
    .find({ guildId, status: "finalized", host: { $in: userIds }, eventDate: { $lt: eventDate } })
    .sort({ eventDate: -1 })
    .project<{ host: string; eventDate: string }>({ _id: 0, host: 1, eventDate: 1 })
    .toArray();
  const lastHostedDates = new Map<string, string>();
  for (const session of previousSessions) {
    if (!lastHostedDates.has(session.host)) lastHostedDates.set(session.host, session.eventDate);
  }
  return lastHostedDates;
}

/** Records the winning slot and host choice and finalizes the round in one write. */
export async function finalizePlanningRound(
  roundId: string,
  slot: string,
  eventDate: string,
  host: string,
  closedAt: Date,
): Promise<boolean> {
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
