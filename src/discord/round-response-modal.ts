/**
 * Builds the combined round response form and coordinates saving its fields.
 */
import { MessageFlags, ModalBuilder, type ModalSubmitInteraction } from "discord.js";
import { isInitialPollOpen, submitAvailability } from "../availability";
import { findPlanningRound, type PlanningRoundDocument } from "../db/planning-rounds";
import { activityNameFieldId, buildActivitySuggestionField, saveSuggestedActivity } from "./activity-suggestion-modal";
import { availabilityFormModalPrefix } from "./constants";

const availableSlotsFieldId = "available-slots";

/** Puts the slot picker and optional suggestion in a single modal. */
export function buildRoundResponseModal(round: PlanningRoundDocument, previousSlots: string[]): ModalBuilder {
  const selectedSlots = new Set(previousSlots);
  return new ModalBuilder()
    .setCustomId(`${availabilityFormModalPrefix}${round._id}`)
    .setTitle("Round availability")
    .addLabelComponents(
      (label) => label
        .setLabel("Which slots work for you?")
        .setStringSelectMenuComponent((menu) => menu
          .setCustomId(availableSlotsFieldId)
          .setMinValues(1)
          .setMaxValues(round.candidateSlots.length)
          .addOptions(round.candidateSlots.map(({ value }) => ({
            label: value,
            value,
            default: selectedSlots.has(value),
          })))),
      buildActivitySuggestionField(),
    );
}

/** Saves a round response, including its optional suggestion. */
export async function handleRoundResponseModal(interaction: ModalSubmitInteraction): Promise<void> {
  // The gateway also routes submissions from other modals through this handler.
  if (!interaction.customId.startsWith(availabilityFormModalPrefix)) return;

  const roundId = interaction.customId.slice(availabilityFormModalPrefix.length);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let availabilitySaved = false;
  let confirmation: string;
  try {
    const round = await findPlanningRound(roundId);
    // A member can leave the form open while an admin wipes the round or the deadline passes.
    if (round === null || round.guildId !== interaction.guildId || !isInitialPollOpen(round)) {
      throw new Error("Responses are no longer open for this round.");
    }
    const name = interaction.fields.getTextInputValue(activityNameFieldId).trim();
    const slots = interaction.fields.getStringSelectValues(availableSlotsFieldId);
    if (slots.length === 0) throw new Error("Select at least one available slot.");
    await submitAvailability(roundId, interaction.user.id, [...slots]);
    availabilitySaved = true;

    if (name.length === 0) {
      confirmation = "Availability saved. Your activity suggestion was left unchanged.";
    } else {
      const savedName = await saveSuggestedActivity(round.guildId, roundId, interaction.user.id, name);
      confirmation = `Availability and activity suggestion saved: **${savedName}**.`;
    }
  } catch (error) {
    console.error(`Round response failed for ${roundId}:`, error instanceof Error ? error.stack : String(error));
    const message = error instanceof Error ? error.message : "Could not save the response.";
    confirmation = availabilitySaved ? `Availability saved. Suggestion failed. ${message}` : message;
  }
  await interaction.editReply({ content: confirmation, allowedMentions: { parse: [] } });
}
