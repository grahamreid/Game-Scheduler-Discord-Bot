/**
 * Declares the `/round` command shape sent to Discord at startup. Separating
 * this from handlers keeps Discord's UI definition easy to scan and change.
 */
import { PermissionsBitField, SlashCommandBuilder } from "discord.js";

export const roundCommand = new SlashCommandBuilder()
  .setName("round")
  .setDescription("Manage board-game planning rounds")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
  .addSubcommand((subcommand) => subcommand
    .setName("create")
    .setDescription("Create a board-game planning round")
    .addStringOption((option) => option.setName("deadline").setDescription("Optional time from now; uses the guild default when omitted, e.g. 1h").setRequired(false))
    .addStringOption((option) => option.setName("title").setDescription("Optional title for this planning round").setRequired(false))
    .addIntegerOption((option) => option.setName("days-ahead").setDescription("Optional number of days to offer; defaults to the guild cadence").setMinValue(1).setMaxValue(25).setRequired(false))
    .addBooleanOption((option) => option.setName("split-weekends").setDescription("Split Saturday and Sunday into Afternoon and Evening slots").setRequired(false)))
  .addSubcommand((subcommand) => subcommand
    .setName("initialize-settings")
    .setDescription("Create or replace this server's scheduling defaults")
    .addStringOption((option) => option.setName("cadence").setDescription("How often a new round should be created").addChoices({ name: "Weekly", value: "weekly" }, { name: "Biweekly", value: "biweekly" }).setRequired(true))
    .addStringOption((option) => option.setName("first-survey-date").setDescription("Date of the first scheduled survey, formatted YYYY-MM-DD").setRequired(true))
    .addStringOption((option) => option.setName("survey-launch-time").setDescription("Future launch time, e.g. 5:00 PM ET or 17:00 CT; supports ET/CT/MT/PT").setRequired(true))
    .addStringOption((option) => option.setName("default-deadline").setDescription("Default duration after launch, e.g. 7h, 1d, or 30m").setRequired(true))
    .addIntegerOption((option) => option.setName("minimum-attendees").setDescription("Members required on one slot for the round to proceed").setMinValue(1).setRequired(true))
    .addBooleanOption((option) => option.setName("split-weekends").setDescription("Split Saturday and Sunday into Afternoon and Evening slots by default").setRequired(true)))
  .addSubcommand((subcommand) => subcommand.setName("wipe").setDescription("Permanently delete this server's planning rounds after confirmation"))
  .addSubcommand((subcommand) => subcommand.setName("status").setDescription("Show slot vote counts, activity suggestions, and who voted in the latest round"));
