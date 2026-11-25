/**
 * Renders and handles Discord's shared availability select menu. This stays
 * separate from slash-command code because message components have their own
 * interaction lifecycle while reusing the same availability business rules.
 */
import {
  ActionRowBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { submitAvailability } from "../availability";
import type { PlanningRoundDocument } from "../db/planning-rounds";
import { buildActivitySuggestionModal } from "./activity-suggestion-modal";
import { availabilityCustomIdPrefix } from "./constants";

/** Builds the shared message content and multi-select component for one round. */
export function buildAvailabilityMessage(round: PlanningRoundDocument): {
  content: string;
  components: ActionRowBuilder<StringSelectMenuBuilder>[];
} {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${availabilityCustomIdPrefix}${round._id}`)
    .setPlaceholder("Select every slot that works for you")
    .setMinValues(1)
    .setMaxValues(round.candidateSlots.length)
    .addOptions(round.candidateSlots.map((slot) => ({ label: slot.value, value: slot.value })));

  const title = round.title === null ? "Board-game Scheduling" : round.title;
  return {
    // Sends a Discord timestamp templated to show in relative time until the deadline.
    content: `**${title}**\nSelect every slot that works for you. Responses close <t:${Math.floor(round.deadline.getTime() / 1000)}:R>.`,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

/** Saves a member's selection from the shared menu and replies only to them. */
export async function handleAvailabilityMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  // This also runs when a member uses a select menu from a different feature.
  if (!interaction.customId.startsWith(availabilityCustomIdPrefix)) return;
  const roundId = interaction.customId.slice(availabilityCustomIdPrefix.length);
  try {
    await submitAvailability(roundId, interaction.user.id, interaction.values);
  } catch (error) {
    console.error(`Could not save availability for round ${roundId}:`, error instanceof Error ? error.stack : String(error));
    const message = error instanceof Error ? error.message : "Could not save availability.";
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await interaction.showModal(buildActivitySuggestionModal(roundId));
  } catch (error) {
    console.error(
      `Could not open the activity suggestion form for round ${roundId}:`,
      error instanceof Error ? error.stack : String(error),
      // Modal builder validation can attach the specific field errors separately.
      error instanceof Error && "errors" in error ? error.errors : "",
    );
    await interaction.reply({
      content: "Your availability was saved, but the activity suggestion form could not open. Select your slots again to retry.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
