import { getDatabase } from "./mongo";

/**
 * Creates MongoDB indexes used by the MVP. MongoDB applies this safely more
 * than once, so it can run at application startup or after Docker starts.
 */
export async function ensureDatabaseIndexes(): Promise<void> {
  const database = await getDatabase();
  const planningRounds = database.collection("planningRounds");
  const indexes = await planningRounds.listIndexes().toArray();
  if (indexes.some((index) => index.name === "planning_round_id")) {
    await planningRounds.dropIndex("planning_round_id");
  }
  await planningRounds.createIndexes([
    { key: { status: 1, availabilityClosesAt: 1 }, name: "open_round_deadline" },
  ]);
}
