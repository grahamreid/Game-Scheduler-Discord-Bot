/** Defines and handles activity history search and administrator cleanup. */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { findActivityHistory, wipeGuildActivities } from "../db/activities";

export const activityCommand = new SlashCommandBuilder()
  .setName("activity")
  .setDescription("Browse or manage board-game activities")
  .addSubcommand((subcommand) => subcommand
    .setName("history")
    .setDescription("Show past activities and their aggregate statistics")
    .addStringOption((option) => option.setName("search").setDescription("Optional activity-name search").setRequired(false)))
  .addSubcommand((subcommand) => subcommand
    .setName("wipe")
    .setDescription("Permanently clear this server's activity data (Manage Server required)"));

/** Routes guild activity commands to history or the administrator wipe flow. */
export async function handleActivityCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  // guildId is null when the command is invoked outside a server, such as in a DM.
  if (interaction.guildId === null) {
    await interaction.reply({ content: "Use this command in a server.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.options.getSubcommand() === "wipe") {
    await handleActivityWipe(interaction, interaction.guildId);
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const entries = await findActivityHistory(interaction.guildId, interaction.options.getString("search") ?? "");
    if (entries.length === 0) {
      await interaction.editReply("No matching activity history yet.");
      return;
    }
    const lines = entries.slice(0, 10).map((entry) => {
      const proposal = entry.proposalRate === null ? "Proposal: no polls yet" : `Proposal: ${Math.round(entry.proposalRate * 100)}%`;
      const popularity = entry.popularityRate === null ? "Popularity: no eligible polls yet" : `Popularity: ${Math.round(entry.popularityRate * 100)}%`;
      return `**${entry.activity.name}** — ${proposal}; ${popularity} (${entry.pollCount} poll${entry.pollCount === 1 ? "" : "s"})`;
    });
    await interaction.editReply(`**Activity history**\n${lines.join("\n")}`);
  } catch {
    await interaction.editReply("Could not retrieve activity history.");
  }
}

/** Confirms the wipe privately before deleting the current guild's activity data. */
async function handleActivityWipe(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({
      content: "You need the Manage Server permission to wipe activities.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const confirmId = "activity-wipe-confirm";
  const cancelId = "activity-wipe-cancel";
  await interaction.reply({
    content: "Are you sure? This permanently deletes this server's activity catalog, suggestions, and votes, and removes the deleted choices from activity polls. Activity polls, planning rounds, and availability responses are kept.",
    flags: MessageFlags.Ephemeral,
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel("Yes, wipe activities").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    )],
  });
  const prompt = await interaction.fetchReply();
  const confirmation = await prompt.awaitMessageComponent({
    componentType: ComponentType.Button,
    filter: (button) => button.user.id === interaction.user.id
      && (button.customId === confirmId || button.customId === cancelId),
    time: 60_000,
  }).catch(() => null);

  if (confirmation === null) {
    await interaction.editReply({ content: "Activity wipe confirmation expired.", components: [] });
    return;
  }
  if (confirmation.customId === cancelId) {
    await confirmation.update({ content: "Activity wipe cancelled.", components: [] });
    return;
  }
  // The requester's permissions can change while the confirmation is open.
  if (!confirmation.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await confirmation.update({ content: "You need the Manage Server permission to wipe activities.", components: [] });
    return;
  }

  await confirmation.update({ content: "Wiping activity data…", components: [] });
  try {
    const deletedCount = await wipeGuildActivities(guildId);
    await interaction.editReply(`Activity data cleared for this server. Catalog entries deleted: ${deletedCount}.`);
  } catch (error) {
    console.error(`Could not finish wiping activities for guild ${guildId}:`, error instanceof Error ? error.stack : String(error));
    await interaction.editReply("Could not finish wiping this server's activity data. Check the bot console for details.");
  }
}
