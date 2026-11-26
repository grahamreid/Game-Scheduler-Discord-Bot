/**
 * Provides an opt-in in-process scheduler for local Discord development. It
 * closes expired availability polls and sends session reminders.
 * Production will trigger these workflows externally.
 */
import type { Client } from "discord.js";
import { announceRoundClosures } from "../discord/round-closure-announcer";
import { announceDueSessionReminders } from "../discord/session-reminder-announcer";
import { closeExpiredRoundsAndPrepareResults } from "../round-result-workflow";

/** Starts one immediate check and then repeats it without overlapping a slow prior run. */
export function startLocalRoundCloser(client: Client, intervalMilliseconds: number): NodeJS.Timeout {
  let isRunning = false;
  const run = async (): Promise<void> => {
    if (isRunning) return;
    isRunning = true;
    try {
      console.log("Local round closer: checking round deadlines and session reminders.");
      const closedRounds = await closeExpiredRoundsAndPrepareResults();
      await announceRoundClosures(client, closedRounds);
      await announceDueSessionReminders(client);
      console.log(`Local round closer: closed ${closedRounds.length} round${closedRounds.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Local round closer failed:", error);
    } finally {
      isRunning = false;
    }
  };

  void run();
  return setInterval(() => void run(), intervalMilliseconds);
}

