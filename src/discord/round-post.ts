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
  const title = round.title === null ? "Board-game Scheduling" : round.title;
  const offersVenueChoice = round.venuePolicy === "either";
  const venueDescription = offersVenueChoice
    ? "**Venue: In person or virtual.** You can change your preference in the form. The session will be virtual if anyone available for the selected slot prefers it."
    : "**Venue: In person only.**";
  const formButtonId = `${availabilityFormButtonPrefix}${round._id}`;
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(formButtonId).setLabel("Submit availability").setStyle(ButtonStyle.Primary),
  );

  return {
    // Sends a Discord timestamp templated to show in relative time until the deadline.
    content: `**${title}**\n${venueDescription}\nShare your availability and optionally suggest an activity. You can respond again to make changes. Responses close <t:${Math.floor(round.deadline.getTime() / 1000)}:R>.`,
    components: [buttons],
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
    await interaction.showModal(buildRoundResponseModal(round, interaction.user.id, previous));
  } catch (error) {
    console.error(`Could not open availability form for round ${roundId}:`, error instanceof Error ? error.stack : String(error));
    if (!interaction.replied) {
      await interaction.reply({ content: "Could not open the availability form. Try again.", flags: MessageFlags.Ephemeral });
    }
  }
}

