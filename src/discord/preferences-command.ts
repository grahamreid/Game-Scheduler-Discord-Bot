/** Lets members read and update their own saved preferences in Discord. */
import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { findMemberPreferences, saveMemberVenuePreference } from "../db/member-preferences";
import { venueLabels } from "./constants";

export const preferencesCommand = new SlashCommandBuilder()
  .setName("preferences")
  .setDescription("Manage your board-game preferences for this server")
  .addSubcommand((subcommand) => subcommand
    .setName("venue")
    .setDescription("Show or set your venue preference for future rounds on this server")
    .addStringOption((option) => option
      .setName("format")
      .setDescription("Choose a format or leave blank to see your current preference")
      .addChoices({ name: venueLabels["in-person"], value: "in-person" }, { name: venueLabels.virtual, value: "virtual" })));

/** Reads or saves the caller's server preference and replies privately. */
export async function handlePreferencesCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { guildId, user } = interaction;
  if (guildId === null) {
    await interaction.reply({ content: "Use this command in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const format = interaction.options.getString("format");
    if (format === null) {
      const preferences = await findMemberPreferences(guildId, user.id);
      const venue = preferences?.venue;
      const label = venue === undefined ? "In person (default)" : venueLabels[venue];
      await interaction.editReply(`Venue preference for future rounds: **${label}**.`);
    } else if (format === "in-person" || format === "virtual") {
      await saveMemberVenuePreference(guildId, user.id, format);
      await interaction.editReply(`Saved **${venueLabels[format]}** as your preference for future rounds on this server.`);
    } else {
      await interaction.editReply("Choose In person or Virtual.");
    }
  } catch (error) {
    console.error(`/preferences venue failed for guild ${guildId}:`, error);
    await interaction.editReply("Could not read or save your venue preference.");
  }
}
