import { getDatabase } from "./mongo";

/**
 * Creates MongoDB indexes used by the MVP. MongoDB applies this safely more
 * than once, so it can run at application startup or after Docker starts.
 */
export async function ensureDatabaseIndexes(): Promise<void> {
  const database = await getDatabase();
  await database.collection("planningRounds").createIndexes([
    { key: { id: 1 }, name: "planning_round_id", unique: true },
    { key: { status: 1, availabilityClosesAt: 1 }, name: "open_round_deadline" },
  ]);
}
