import type { Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import type { CandidateDate, PlanningRound } from "../domain/rounds/types";
import { getDatabase } from "./mongo";

/** The data supplied by an administrator when opening a planning round. */
export interface CreatePlanningRoundInput {
  guildId: string;
  channelId: string;
  title?: string;
  availabilityClosesAt: Date;
  candidateDates: Array<{ date: string; displayOrder: number }>;
}

/**
 * MongoDB document for a planning round. Candidate dates are embedded because
 * they only exist within one round and are always read with that round.
 */
interface PlanningRoundDocument extends PlanningRound {
  _id: string;
  candidateDates: CandidateDate[];
}

async function rounds(): Promise<Collection<PlanningRoundDocument>> {
  return (await getDatabase()).collection<PlanningRoundDocument>("planningRounds");
}

/** Creates an open round and assigns stable IDs to its candidate dates. */
export async function createPlanningRound(input: CreatePlanningRoundInput): Promise<PlanningRoundDocument> {
  const now = new Date();
  const id = randomUUID();
  const round: PlanningRoundDocument = {
    _id: id,
    id,
    guildId: input.guildId,
    channelId: input.channelId,
    status: "open",
    title: input.title ?? null,
    availabilityClosesAt: input.availabilityClosesAt,
    selectedDate: null,
    selectedHostUserId: null,
    finalizedAt: null,
    createdAt: now,
    updatedAt: now,
    candidateDates: input.candidateDates.map((candidate) => ({
      id: randomUUID(),
      roundId: id,
      date: candidate.date,
      displayOrder: candidate.displayOrder,
    })),
  };
  await (await rounds()).insertOne(round);
  return round;
}

/** Looks up a round by its ID, or returns null when it is absent. */
export async function findPlanningRound(id: string): Promise<PlanningRoundDocument | null> {
  return (await rounds()).findOne({ _id: id });
}
