/**
 * Contains narrowly scoped cleanup for simulator-created records. It is kept
 * separate from regular database helpers to make its safe, non-production use
 * obvious.
 */
import { getDatabase } from "./mongo";

/**
 * Removes only documents created by the local simulator. It never touches
 * actual guild data, so it is safe to run before a repeatable simulation.
 */
export async function clearSimulationData(): Promise<void> {
  const database = await getDatabase();
  const rounds = await database.collection("planningRounds")
    .find({ guildId: "simulation-guild" }, { projection: { _id: 1 } })
    .toArray();
  const roundIds = rounds.map((round) => round._id);
  if (roundIds.length > 0) {
    await database.collection("availabilityResponses").deleteMany({ roundId: { $in: roundIds } });
  }
  await database.collection("planningRounds").deleteMany({ guildId: "simulation-guild" });
}
