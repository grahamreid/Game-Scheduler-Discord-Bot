/**
 * Provides an opt-in in-process scheduler for local Discord development. It
 * closes expired availability polls and posts their current availability result;
 * production will trigger the same close-round workflow externally instead.
 */
import type { Client } from "discord.js";
import { announceRoundClosures } from "../discord/round-closure-announcer";
import { closeExpiredRoundsAndPrepareResults } from "../round-result-workflow";

/** Starts one immediate check and then repeats it without overlapping a slow prior run. */
export function startLocalRoundCloser(client: Client, intervalMilliseconds: number): NodeJS.Timeout {
  let isRunning = false;
  const run = async (): Promise<void> => {
    if (isRunning) return;
    isRunning = true;
    try {
      console.log("Local round closer: checking for expired rounds.");
      const results = await closeExpiredRoundsAndPrepareResults();
      await announceRoundClosures(client, results);
      console.log(`Local round closer: closed ${results.length} round${results.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Local round closer failed:", error);
    } finally {
      isRunning = false;
    }
  };

  void run();
  return setInterval(() => void run(), intervalMilliseconds);
}

