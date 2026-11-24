/**
 * Runs a repeatable end-to-end workflow without Discord. This is a CLI entry
 * point rather than business logic so manual validation stays separate.
 */
import { submitAvailability } from "../../availability";
import { closeDatabase } from "../../db/mongo";
import { createPlanningRound, findPlanningRound } from "../../db/planning-rounds";
import { clearSimulationData } from "../../db/simulation-data";
import { processDeadlines } from "../../scheduling/process-deadlines";

async function main(): Promise<void> {
  const now = new Date();
  await clearSimulationData();
  const round = await createPlanningRound({
    guildId: "simulation-guild",
    channelId: "simulation-channel",
    title: "Simulated board-game night",
    deadline: new Date(now.getTime() + 60 * 60 * 1000),
    slots: [
      "2026-12-04",
      "2026-12-05",
    ],
  });

  const friday = round.candidateSlots[0].value;
  const saturday = round.candidateSlots[1].value;
  await submitAvailability(round._id, "alex", [friday, saturday], now);
  await submitAvailability(round._id, "blair", [friday], now);
  await submitAvailability(round._id, "casey", [friday], now);

  const processingTime = new Date(round.deadline.getTime() + 1);
  const results = await processDeadlines(processingTime);
  const completedRound = await findPlanningRound(round._id);
  console.log(JSON.stringify({ results, completedRound }, null, 2));
  await closeDatabase();
}

void main();
