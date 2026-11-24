/**
 * Defines and handles `/round` commands. It stays separate from the bot's
 * connection lifecycle so command behavior can grow without bloating index.ts.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { createPlanningRound, wipeGuildRounds } from "../db/planning-rounds";
import { buildAvailabilityMessage } from "./availability-menu";

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
      .setRequired(false)))
  .addSubcommand((subcommand) => subcommand
    .setName("wipe")
    .setDescription("Permanently delete this server's planning rounds after confirmation"));

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


const wipeConfirmPrefix = "round-wipe-confirm:";
const wipeCancelPrefix = "round-wipe-cancel:";

/** Handles administrator-only `/round` commands. */
export async function handleRoundCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: "You need the Manage Server permission to create a round.", ephemeral: true });
    return;
  }
  if (interaction.guildId === null) return;

  if (interaction.options.getSubcommand() === "wipe") {
    const confirmationId = `${wipeConfirmPrefix}${interaction.guildId}:${interaction.user.id}`;
    const cancelId = `${wipeCancelPrefix}${interaction.guildId}:${interaction.user.id}`;
    await interaction.reply({
      content: "Are you sure? This permanently deletes every planning round and availability response for this server.",
      ephemeral: true,
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(confirmationId).setLabel("Yes, wipe rounds").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(cancelId).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
      )],
    });
    return;
  }

  if (interaction.options.getSubcommand() !== "create") return;

  try {
    await interaction.deferReply({ ephemeral: true });
    const round = await createPlanningRound({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      title: interaction.options.getString("title") ?? undefined,
      deadline: parseDeadline(interaction.options.getString("deadline", true)),
      slots: parseSlots(interaction.options.getString("slots", true)),
    });
    if (interaction.channel === null || !interaction.channel.isSendable()) {
      throw new Error("Run this command in a text channel.");
    }
    await interaction.channel.send(buildAvailabilityMessage(round));
    await interaction.editReply(`Created round \`${round._id}\` and posted its availability menu.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the round.";
    if (interaction.deferred) await interaction.editReply(message);
    else await interaction.reply({ content: message, ephemeral: true });
  }
}

/** Handles the private confirmation buttons sent by `/round wipe`. */
export async function handleRoundWipeButton(interaction: ButtonInteraction): Promise<void> {
  const isConfirm = interaction.customId.startsWith(wipeConfirmPrefix);
  const isCancel = interaction.customId.startsWith(wipeCancelPrefix);
  if (!isConfirm && !isCancel) return;

  const [guildId, requestingUserId] = interaction.customId
    .slice((isConfirm ? wipeConfirmPrefix : wipeCancelPrefix).length)
    .split(":");
  if (interaction.guildId !== guildId || interaction.user.id !== requestingUserId) {
    // NOTE This is needed because this logic handles all wipe button clicks for all users and all guilds,
    // so we must ensure that only the administrator who requested the wipe can confirm it for the affected guild.
    await interaction.reply({ content: "Only the administrator who requested this wipe can confirm it.", ephemeral: true });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: "You need the Manage Server permission to wipe rounds.", ephemeral: true });
    return;
  }
  if (!isConfirm) {
    await interaction.update({ content: "Wipe cancelled.", components: [] });
    return;
  }

  await interaction.deferUpdate();
  try {
    const deletedCount = await wipeGuildRounds(guildId);
    await interaction.editReply({
      content: `Deleted ${deletedCount} planning round${deletedCount === 1 ? "" : "s"} and their availability responses.`,
      components: [],
    });
  } catch {
    await interaction.editReply({ content: "Could not wipe this server's rounds.", components: [] });
  }
}
