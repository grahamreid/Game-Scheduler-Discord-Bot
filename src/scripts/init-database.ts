/**
 * Command-line entry point that creates required MongoDB indexes. It exists so
 * developers can prepare a new local database before starting the Discord bot.
 */
import { closeDatabase } from "../db/mongo";
import { ensureDatabaseIndexes } from "../db/setup";

async function main(): Promise<void> {
  await ensureDatabaseIndexes();
  await closeDatabase();
  console.log("MongoDB indexes are ready.");
}

void main();
