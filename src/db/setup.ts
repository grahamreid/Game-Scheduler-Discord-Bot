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
  const availabilityResponses = database.collection("availabilityResponses");
  await ensureIndex(availabilityResponses, "one_response_per_member_per_round", { roundId: 1, userId: 1 }, true);
  await ensureIndex(availabilityResponses, "responses_by_round", { roundId: 1 });
  const guildSchedulingSettings = database.collection("guildSchedulingSettings");
  await ensureIndex(guildSchedulingSettings, "one_scheduling_setting_per_guild", { guildId: 1 }, true);
}

/** Replaces an outdated named index instead of letting an old local schema block startup. */
async function ensureIndex(
  collection: Collection<Document>,
  name: string,
  key: Record<string, 1 | -1>,
  unique = false,
): Promise<void> {
  // Ask MongoDB which indexes already exist rather than blindly issuing
  // createIndex: startup may run repeatedly and a developer may have changed
  // an index definition since their last local run.
  let indexes: Document[];
  try {
    indexes = await collection.listIndexes().toArray();
  } catch (error) {
    // listIndexes fails with MongoDB code 26 before a collection has ever had
    // a document or index. Treat that as an empty collection; createIndex below
    // creates the collection along with its first requested index.
    if (!isNamespaceNotFound(error)) throw error;
    indexes = [];
  }
  const namedIndex = indexes.find((index) => index.name === name);

  // An index with *our* name but different fields or uniqueness is stale. Drop
  // only that named index, then refresh the list before deciding what to make.
  if (
    namedIndex !== undefined
    && (JSON.stringify(namedIndex.key) !== JSON.stringify(key) || Boolean(namedIndex.unique) !== unique)
  ) {
    await collection.dropIndex(name);
    indexes = await collection.listIndexes().toArray();
  }

  // MongoDB will reject a duplicate key pattern even when its name differs.
  // Treat an equivalent existing index as sufficient; this makes startup safe
  // with old local databases and avoids the duplicate-index error seen earlier.
  if (indexes.some((index) => JSON.stringify(index.key) === JSON.stringify(key))) return;

  // No matching index remains, so create the definition requested by this app.
  await collection.createIndex(key, { name, unique });
}

/** Identifies MongoDB's expected "collection does not exist yet" response. */
function isNamespaceNotFound(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === 26;
}
