/**
 * Builds the combined round response form and coordinates saving its fields.
 */
import { MessageFlags, ModalBuilder, type ModalSubmitInteraction } from "discord.js";
import { isInitialPollOpen, submitAvailability } from "../availability";
import { findPlanningRound, setRoundVenuePreference, type PlanningRoundDocument } from "../db/planning-rounds";
import { activityNameFieldId, buildActivitySuggestionField, saveSuggestedActivity } from "./activity-suggestion-modal";
import { availabilityFormModalPrefix, venueLabels } from "./constants";

const availableSlotsFieldId = "available-slots";
const venueFieldId = "round-venue";

/** Builds the response form and shows the venue picker for rounds that offer a choice. */
export function buildRoundResponseModal(round: PlanningRoundDocument, userId: string, previousSlots: string[]): ModalBuilder {
  const selectedSlots = new Set(previousSlots);
  const modal = new ModalBuilder()
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

  if (round.venuePolicy === "either") {
    const prefersVirtual = round.virtualPreferenceUserIds.includes(userId);
    modal.addLabelComponents((label) => label
      .setLabel("How would you prefer to join this round?")
      .setStringSelectMenuComponent((menu) => menu
        .setCustomId(venueFieldId)
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          { label: venueLabels["in-person"], value: "in-person", default: !prefersVirtual },
          { label: venueLabels.virtual, value: "virtual", default: prefersVirtual },
        )));
  }
  return modal;
}

/** Saves the response, including the round venue choice and activity suggestion when provided. */
export async function handleRoundResponseModal(interaction: ModalSubmitInteraction): Promise<void> {
  // The gateway also routes submissions from other modals through this handler.
  if (!interaction.customId.startsWith(availabilityFormModalPrefix)) return;

  const roundId = interaction.customId.slice(availabilityFormModalPrefix.length);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  let saved = "";
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
    const venue = round.venuePolicy === "either" ? interaction.fields.getStringSelectValues(venueFieldId)[0] : null;
    if (venue !== null && venue !== "in-person" && venue !== "virtual") {
      throw new Error("Choose In person or Virtual for this round.");
    }
    await submitAvailability(roundId, interaction.user.id, [...slots]);
    saved = "Availability saved.";
    if (venue !== null) {
      if (!await setRoundVenuePreference(roundId, interaction.user.id, venue)) {
        throw new Error("The round closed before your venue preference could be saved.");
      }
      saved += ` Preference for this round: **${venueLabels[venue]}**.`;
    }

    if (name.length === 0) {
      confirmation = `${saved} Your activity suggestion was left unchanged.`;
    } else {
      const savedName = await saveSuggestedActivity(round.guildId, roundId, interaction.user.id, name);
      confirmation = `${saved} Activity suggestion saved: **${savedName}**.`;
    }
  } catch (error) {
    console.error(`Round response failed for ${roundId}:`, error instanceof Error ? error.stack : String(error));
    const message = error instanceof Error ? error.message : "Could not save the response.";
    confirmation = saved.length > 0 ? `${saved} Could not save the rest of your response. ${message}` : message;
  }
  await interaction.editReply({ content: confirmation, allowedMentions: { parse: [] } });
}
