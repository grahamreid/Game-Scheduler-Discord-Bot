/**
 * Renders and handles Discord's shared availability select menu. This stays
 * separate from slash-command code because message components have their own
 * interaction lifecycle while reusing the same availability business rules.
 */
import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { submitAvailability } from "../availability";
import type { PlanningRoundDocument } from "../db/planning-rounds";

const customIdPrefix = "availability:";
/** Builds the shared message content and multi-select component for one round. */
export function buildAvailabilityMessage(round: PlanningRoundDocument): {
  content: string;
  components: ActionRowBuilder<StringSelectMenuBuilder>[];
} {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${customIdPrefix}${round._id}`)
    .setPlaceholder("Select every slot that works for you")
    .setMinValues(1)
    .setMaxValues(round.candidateSlots.length)
    .addOptions(round.candidateSlots.map((slot) => ({ label: slot.value, value: slot.value })));

  const title = round.title === null ? "Board-game Scheduling" : round.title;
  return {
    content: `**${title}**\nSelect every slot that works for you. Responses close <t:${Math.floor(round.deadline.getTime() / 1000)}:R>.`,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

/** Saves a member's selection from the shared menu and replies only to them. */
export async function handleAvailabilityMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.customId.startsWith(customIdPrefix)) return;
  const roundId = interaction.customId.slice(customIdPrefix.length);
  await interaction.deferReply({ ephemeral: true }); // NOTE Shows up as "thinking..." to the user while we process their selection.
  try {
    await submitAvailability(roundId, interaction.user.id, interaction.values);
    await interaction.editReply("Availability saved. Thanks!");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save availability.";
    await interaction.editReply(message);
  }
}
