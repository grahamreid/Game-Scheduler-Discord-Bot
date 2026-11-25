/**
 * Collects an optional free-text activity immediately after availability is
 * saved. New names are searchable as soon as they enter the guild catalog.
 */
import { ModalBuilder, ModalSubmitInteraction, TextInputStyle } from "discord.js";
import { isInitialPollOpen } from "../availability";
import { findOrCreateActivity } from "../db/activities";
import { saveActivitySuggestion } from "../db/activity-suggestions";
import { findPlanningRound } from "../db/planning-rounds";
import { activitySuggestionModalPrefix } from "./constants";

const activityNameFieldId = "activity-name";

/** Builds the follow-up modal shown after a member submits availability. */
export function buildActivitySuggestionModal(roundId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${activitySuggestionModalPrefix}${roundId}`)
    .setTitle("Optional activity suggestion")
    .addLabelComponents((label) => label
      .setLabel("Suggest one activity")
      .setDescription("Browse past suggestions with /activity history.")
      .setTextInputComponent((input) => input
        .setCustomId(activityNameFieldId)
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100)
        .setPlaceholder("Enter a new suggestion or leave blank to make no change")));
}

/** Saves the optional suggestion after availability was already recorded. */
export async function handleActivitySuggestionModal(interaction: ModalSubmitInteraction): Promise<void> {
  
  // Guard here because this can also run when a member submits a modal from a different feature.
  if (!interaction.customId.startsWith(activitySuggestionModalPrefix)) return;

  const roundId = interaction.customId.slice(activitySuggestionModalPrefix.length);
  const name = interaction.fields.getTextInputValue(activityNameFieldId);
  await interaction.deferReply({ ephemeral: true });
  try {
    const round = await findPlanningRound(roundId);
    // A member can leave the form open while an admin wipes the round or the deadline passes.
    if (round === null || round.guildId !== interaction.guildId || !isInitialPollOpen(round)) {
      throw new Error("Activity suggestions are no longer open for this round.");
    }
    if (name.trim().length === 0) {
      await interaction.editReply("Availability saved. Your activity suggestion was left unchanged.");
      return;
    }
    const activity = await findOrCreateActivity(round.guildId, name, interaction.user.id);
    await saveActivitySuggestion(roundId, interaction.user.id, activity._id);
    await interaction.editReply(`Availability and activity suggestion saved: **${activity.name}**. You can browse prior suggestions with /activity history.`);
  } catch (error) {
    console.error(`Could not save an activity suggestion for round ${roundId}:`, error instanceof Error ? error.stack : String(error));
    await interaction.editReply(error instanceof Error ? error.message : "Could not save activity suggestion.");
  }
}
