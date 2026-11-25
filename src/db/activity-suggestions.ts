/** Stores one replaceable private activity suggestion per member and round. */
import type { Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import type { Activity, ActivitySuggestion } from "../types";
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

/** Lists distinct activity names currently suggested for the round. */
export async function getActivitySuggestions(roundId: string, guildId: string): Promise<string[]> {
  const activityIds = await (await suggestions()).distinct("activityId", { roundId });
  const database = await getDatabase();
  const activities = await database.collection<Activity>("activities")
    .find({ guildId, _id: { $in: activityIds } }, { projection: { name: 1 } })
    .toArray();
  return activities.map((activity) => activity.name).sort((left, right) => left.localeCompare(right));
}
