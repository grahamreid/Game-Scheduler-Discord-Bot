/**
 * Database index setup is isolated from connection code so it can run from a
 * command without being mixed into normal reads and writes.
 */
import type { Collection, Document } from "mongodb";
import { getDatabase } from "./mongo";

/**
 * Creates MongoDB indexes used by the MVP. MongoDB applies this safely more
 * than once, so it can run at application startup or after Docker starts.
 */
export async function ensureDatabaseIndexes(): Promise<void> {
  const database = await getDatabase();
  const planningRounds = database.collection("planningRounds");
  await ensureIndex(planningRounds, "open_round_deadline", { status: 1, deadline: 1 });
  await ensureIndex(planningRounds, "guild_active_round", { guildId: 1, status: 1 });
}

/** Replaces an outdated named index instead of letting an old local schema block startup. */
async function ensureIndex(
  collection: Collection<Document>,
  name: string,
  key: Record<string, 1 | -1>,
): Promise<void> {
  let indexes = await collection.listIndexes().toArray();
  const namedIndex = indexes.find((index) => index.name === name);
  if (namedIndex !== undefined && JSON.stringify(namedIndex.key) !== JSON.stringify(key)) {
    await collection.dropIndex(name);
    indexes = await collection.listIndexes().toArray();
  }
  if (indexes.some((index) => JSON.stringify(index.key) === JSON.stringify(key))) return;
  await collection.createIndex(key, { name });
}
