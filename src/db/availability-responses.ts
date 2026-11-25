/**
 * Stores member availability separately from planning rounds. A separate
 * collection lets a member replace their answer without rewriting the whole
 * round document, while a unique index preserves one current answer per user.
 */
import type { Collection } from "mongodb";
import type { AvailabilityResponse } from "../types";
import { getDatabase } from "./mongo";

async function responses(): Promise<Collection<AvailabilityResponse>> {
  return (await getDatabase()).collection<AvailabilityResponse>("availabilityResponses");
}

/** Saves a member's current selection, replacing their previous selection for this round. */
export async function saveAvailabilityResponse(response: AvailabilityResponse): Promise<void> {
  await (await responses()).updateOne(
    { roundId: response.roundId, userId: response.userId },
    { $set: response },
    { upsert: true },
  );
}

/** Retrieves every member's current availability for a round at deadline time. */
export async function findAvailabilityResponses(roundId: string): Promise<AvailabilityResponse[]> {
  return (await responses()).find({ roundId }).toArray();
}

/** Loads a member's previous selections when they reopen the availability form. */
export async function findMemberAvailability(roundId: string, userId: string): Promise<AvailabilityResponse | null> {
  return (await responses()).findOne({ roundId, userId });
}

/** Counts submitted member responses without loading every response document. */
export async function countAvailabilityResponses(roundId: string): Promise<number> {
  return (await responses()).countDocuments({ roundId });
}
