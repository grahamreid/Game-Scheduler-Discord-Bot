/** Renders the shared activity poll and acknowledges individual ballots privately. */
import { ActionRowBuilder, MessageFlags, StringSelectMenuBuilder, type MessageCreateOptions, type StringSelectMenuInteraction } from "discord.js";
import { getOpenActivityPoll, submitActivityBallot, type ActivityPollChoices } from "../activity-voting";
import { activityVoteMenuPrefix } from "./constants";

/** Builds the shared voting message with an inline activity dropdown. */
export function buildActivityPollMessage({ poll, choices }: ActivityPollChoices): MessageCreateOptions {
  const voteLimit = Math.min(poll.voteLimit, choices.length);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${activityVoteMenuPrefix}${poll.roundId}`)
    .setPlaceholder("Choose activities")
    .setMinValues(1)
    .setMaxValues(voteLimit)
    .addOptions(choices.map((activity) => ({ label: activity.name, value: activity._id })));
  return {
    content: `**What would you like to play?**\nAttendees can choose up to **${voteLimit}**. You can resubmit through the session date. Votes are for discussion.`,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

/** Checks the current poll and saves the choices submitted from its dropdown. */
export async function handleActivityVote(interaction: StringSelectMenuInteraction): Promise<void> {
  const roundId = interaction.customId.slice(activityVoteMenuPrefix.length);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const poll = await getOpenActivityPoll(roundId, interaction.guildId, interaction.user.id);
    await submitActivityBallot(poll, interaction.user.id, interaction.values);
  } catch (error) {
    console.error(`Activity ballot failed for round ${roundId}:`, error instanceof Error ? error.stack : String(error));
    await interaction.editReply(error instanceof Error ? error.message : "Could not save your activity ballot.");
    return;
  }
  await interaction.editReply("Your activity ballot was saved.");
}
