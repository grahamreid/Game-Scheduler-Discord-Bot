import { closeDatabase } from "../db/mongo";
import { ensureDatabaseIndexes } from "../db/setup";

async function main(): Promise<void> {
  await ensureDatabaseIndexes();
  await closeDatabase();
  console.log("MongoDB indexes are ready.");
}

void main();
