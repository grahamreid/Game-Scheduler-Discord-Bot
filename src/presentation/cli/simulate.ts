import { closeDatabase } from "../../db/mongo";
import { createPlanningRound } from "../../db/planning-rounds";
import { ensureDatabaseIndexes } from "../../db/setup";

async function main(): Promise<void> {
  const now = new Date();
  await ensureDatabaseIndexes();
  const round = await createPlanningRound({
    guildId: "simulation-guild",
    channelId: "simulation-channel",
    title: "Simulated board-game night",
    availabilityClosesAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    candidateDates: [
      { date: "2026-12-04", displayOrder: 1 },
      { date: "2026-12-05", displayOrder: 2 },
    ],
  });

  console.log(JSON.stringify(round, null, 2));
  await closeDatabase();
}

void main();
