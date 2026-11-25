/**
 * Defines the optional activity suggestion field and saves its value for the round.
 */
import { LabelBuilder, TextInputStyle } from "discord.js";
import { findOrCreateActivity } from "../db/activities";
import { saveActivitySuggestion } from "../db/activity-suggestions";

export const activityNameFieldId = "activity-name";

/** Builds the optional free-text field and its activity history hint. */
export function buildActivitySuggestionField(): LabelBuilder {
  return new LabelBuilder()
    .setLabel("Suggest one activity")
    .setDescription("Browse past suggestions with /activity history.")
    .setTextInputComponent((input) => input
      .setCustomId(activityNameFieldId)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100)
      .setPlaceholder("Enter a new suggestion or leave blank to make no change"));
}

/** Saves a non-empty suggestion and returns its catalog name for the confirmation. */
export async function saveSuggestedActivity(guildId: string, roundId: string, userId: string, name: string): Promise<string> {
  const activity = await findOrCreateActivity(guildId, name, userId);
  await saveActivitySuggestion(roundId, userId, activity._id);
  return activity.name;
}
