/** Stores one replaceable private activity suggestion per member and round. */
import { randomUUID } from "node:crypto";
import type { Collection } from "mongodb";
import type { ActivitySuggestion } from "../types";
import { getDatabase } from "./mongo";

async function suggestions(): Promise<Collection<ActivitySuggestion>> {
  return (await getDatabase()).collection<ActivitySuggestion>("activitySuggestions");
}

/** Saves a member's one current suggestion, replacing their earlier suggestion in the round. */
export async function saveActivitySuggestion(roundId: string, userId: string, activityId: string): Promise<void> {
  await (await suggestions()).updateOne(
    { roundId, userId },
    { $set: { activityId, suggestedAt: new Date() }, $setOnInsert: { _id: randomUUID(), roundId, userId } },
    { upsert: true },
  );
}
