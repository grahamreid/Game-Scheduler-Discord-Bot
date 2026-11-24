/**
 * Defines and handles `/round` commands. It stays separate from the bot's
 * connection lifecycle so command behavior can grow without bloating index.ts.
 */
import {
  ChatInputCommandInteraction,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { createPlanningRound } from "../db/planning-rounds";

export const roundCommand = new SlashCommandBuilder()
  .setName("round")
  .setDescription("Manage board-game planning rounds")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
  .addSubcommand((subcommand) => subcommand
    .setName("create")
    .setDescription("Create a board-game planning round")
    .addStringOption((option) => option
      .setName("deadline")
      .setDescription("Time from now: 1m, 1h, or 1d")
      .setRequired(true))
    .addStringOption((option) => option
      .setName("slots")
      .setDescription("Comma-separated options, e.g. Friday,Saturday")
      .setRequired(true))
    .addStringOption((option) => option
      .setName("title")
      .setDescription("Optional title for this planning round")
      .setRequired(false)));

function parseDeadline(value: string): Date {
  const match = /^(\d+)(m|h|d)$/i.exec(value.trim());
  if (match === null) throw new Error("Deadline must be a duration such as 1m, 1h, or 1d.");
  const amount = Number(match[1]);
  const unitMilliseconds = { m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase() as "m" | "h" | "d"];
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Deadline duration must be a positive whole number.");
  }
  return new Date(Date.now() + amount * unitMilliseconds);
}

function parseSlots(value: string): string[] {
  const slots = value.split(",").map((slot) => slot.trim()).filter(Boolean);
  if (slots.length === 0) {
    throw new Error("Provide at least one comma-separated slot.");
  }
  if (new Set(slots).size !== slots.length) {
    throw new Error("Each slot must appear only once.");
  }
  return slots;
}

/** Handles the currently supported administrator-only `/round create` command. */
export async function handleRoundCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: "You need the Manage Server permission to create a round.", ephemeral: true });
    return;
  }
  if (interaction.options.getSubcommand() !== "create" || interaction.guildId === null) return;

  try {
    const round = await createPlanningRound({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      title: interaction.options.getString("title") ?? undefined,
      deadline: parseDeadline(interaction.options.getString("deadline", true)),
      slots: parseSlots(interaction.options.getString("slots", true)),
    });
    await interaction.reply({
      content: `Created round \`${round._id}\` with deadline <t:${Math.floor(round.deadline.getTime() / 1000)}:F>. Availability controls will be added next.`,
      ephemeral: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the round.";
    await interaction.reply({ content: message, ephemeral: true });
  }
}
