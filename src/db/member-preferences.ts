/** Stores preferences that belong to a guild member and carry across rounds. */
import type { MemberPreferences, VenuePreference } from "../types";
import { getDatabase } from "./mongo";

async function memberPreferences() {
  return (await getDatabase()).collection<MemberPreferences>("memberPreferences");
}

/** Loads any saved preferences for this member in the current guild. */
export async function findMemberPreferences(guildId: string, userId: string): Promise<MemberPreferences | null> {
  return (await memberPreferences()).findOne({ guildId, userId });
}

/** Creates the member's record if needed and updates only their venue preference. */
export async function saveMemberVenuePreference(guildId: string, userId: string, venue: VenuePreference): Promise<void> {
  await (await memberPreferences()).updateOne({ guildId, userId }, { $set: { venue } }, { upsert: true });
}

/** Loads the saved virtual preferences to snapshot when a round opens. */
export async function findVirtualPreferenceUserIds(guildId: string): Promise<string[]> {
  return (await memberPreferences()).distinct("userId", { guildId, venue: "virtual" });
}
