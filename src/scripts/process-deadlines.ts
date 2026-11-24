/**
 * Manual command-line entry point for deadline processing. It is separate from
 * the scheduling workflow so a future cloud scheduler can call that workflow
 * without inheriting command-line concerns.
 */
import { closeDatabase } from "../db/mongo";
import { ensureDatabaseIndexes } from "../db/setup";
import { closeExpiredRounds } from "../scheduling/close-round";

async function main(): Promise<void> {
  await ensureDatabaseIndexes();
  const results = await closeExpiredRounds();
  console.log(JSON.stringify(results, null, 2));
  await closeDatabase();
}

void main();
