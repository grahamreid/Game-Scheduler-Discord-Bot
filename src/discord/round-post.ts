/**
 * Renders the shared round post and handles the button that opens the form.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { isInitialPollOpen } from "../availability";
import { findMemberAvailability } from "../db/availability-responses";
import { findPlanningRound, type PlanningRoundDocument } from "../db/planning-rounds";
import { availabilityFormButtonPrefix } from "./constants";
import { buildRoundResponseModal } from "./round-response-modal";

/** Builds the shared post that opens each member's response form. */
export function buildRoundPost(round: PlanningRoundDocument): {
  content: string;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const button = new ButtonBuilder()
    .setCustomId(`${availabilityFormButtonPrefix}${round._id}`)
    .setLabel("Submit availability")
    .setStyle(ButtonStyle.Primary);

  const title = round.title === null ? "Board-game Scheduling" : round.title;
  const venueDescription = round.venuePolicy === "either"
    ? "**Venue: In person or virtual.** The session will be virtual if anyone available for the selected slot prefers it."
    : "**Venue: In person only.**";
  return {
    // Sends a Discord timestamp templated to show in relative time until the deadline.
    content: `**${title}**\n${venueDescription}\nChoose your available slots and optionally suggest an activity. You can reopen the form to make changes. Responses close <t:${Math.floor(round.deadline.getTime() / 1000)}:R>.`,
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  };
}

/** Opens the response form with any slots the member previously selected. */
export async function handleAvailabilityFormButton(interaction: ButtonInteraction): Promise<void> {
  const roundId = interaction.customId.slice(availabilityFormButtonPrefix.length);
  try {
    const [round, previous] = await Promise.all([
      findPlanningRound(roundId),
      findMemberAvailability(roundId, interaction.user.id),
    ]);
    // A member can click an old post after its round is closed or wiped.
    if (round === null || round.guildId !== interaction.guildId || !isInitialPollOpen(round)) {
      await interaction.reply({
        content: "Availability is no longer open for this round.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.showModal(buildRoundResponseModal(round, interaction.user.id, previous?.slots ?? []));
  } catch (error) {
    console.error(`Could not open availability form for round ${roundId}:`, error instanceof Error ? error.stack : String(error));
    if (!interaction.replied) {
      await interaction.reply({ content: "Could not open the availability form. Try again.", flags: MessageFlags.Ephemeral });
    }
  }
}

