/**
 * Stores scheduling defaults for each Discord guild. These settings outlive a
 * single planning round and let manual and future automated creation generate
 * the same dated availability slots.
 */
import type { Collection } from "mongodb";
import type { GuildSchedulingSettings, RoundCadence } from "../types";
import { getDatabase } from "./mongo";

async function schedulingSettings(): Promise<Collection<GuildSchedulingSettings>> {
  return (await getDatabase()).collection<GuildSchedulingSettings>("guildSchedulingSettings");
}

/** Retrieves a guild's scheduling settings, if an administrator has configured them. */
export async function findGuildSchedulingSettings(guildId: string): Promise<GuildSchedulingSettings | null> {
  return (await schedulingSettings()).findOne({ guildId });
}

/** Creates or replaces the scheduling settings for one guild. */
export async function saveGuildSchedulingSettings(
  guildId: string,
  cadence: RoundCadence,
  firstSurveyDate: string,
  surveyLaunchTime: string,
  surveyTimeZone: string,
  defaultDeadline: string,
  splitWeekendSlots: boolean,
): Promise<void> {
  const now = new Date();
  await (await schedulingSettings()).updateOne(
    { guildId },
    {
      $set: { cadence, firstSurveyDate, surveyLaunchTime, surveyTimeZone, defaultDeadline, splitWeekendSlots, updatedAt: now },
      $setOnInsert: { guildId, createdAt: now },
    },
    { upsert: true },
  );
}
