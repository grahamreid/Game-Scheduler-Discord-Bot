/**
 * Command-line entry point for deleting only simulator-owned data. Keeping it
 * separate makes a destructive action explicit and easy to audit.
 */
import { closeDatabase } from "../db/mongo";
import { clearSimulationData } from "../db/simulation-data";

async function main(): Promise<void> {
  await clearSimulationData();
  await closeDatabase();
  console.log("Simulator data cleared.");
}

void main();
