/**
 * Handles the administrator-only `/round` commands and wipe confirmation.
 * Member-facing availability interaction stays in availability-menu.ts because
 * it has different permissions and a separate component lifecycle.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  PermissionsBitField,
} from "discord.js";
import { findAvailabilityResponses } from "../db/availability-responses";
import { findGuildSchedulingSettings, saveGuildSchedulingSettings } from "../db/guild-scheduling-settings";
import { createPlanningRound, findOpenPlanningRound, wipeGuildRounds } from "../db/planning-rounds";
import { daysForCadence, generateRoundSlots } from "../slot-generation";
import { buildAvailabilityMessage } from "./availability-menu";
import { wipeCancelPrefix, wipeConfirmPrefix } from "./constants";
import { parseCadence, parseCalendarDate, parseDeadline, parseSurveyLaunchTime } from "./command-parsers";

/** Routes an administrator's `/round` subcommand to its focused handler. */
export async function handleAdminRoundCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: "You need the Manage Server permission to use round administration commands.", ephemeral: true });
    return;
  }
  if (interaction.guildId === null) return;

  switch (interaction.options.getSubcommand()) {
    case "create": return handleCreateRound(interaction);
    case "initialize-settings": return handleInitializeSettings(interaction);
    case "status": return handleRoundStatus(interaction);
    case "wipe": return handleRoundWipeRequest(interaction);
  }
}

/** Saves the reusable scheduling defaults for a guild. */
async function handleInitializeSettings(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const cadence = parseCadence(interaction.options.getString("cadence", true));
    const firstSurveyDate = parseCalendarDate(interaction.options.getString("first-survey-date", true));
    const launchTime = parseSurveyLaunchTime(interaction.options.getString("survey-launch-time", true));
    const defaultDeadline = interaction.options.getString("default-deadline", true);
    parseDeadline(defaultDeadline);
    const splitWeekendSlots = interaction.options.getBoolean("split-weekends", true);
    await saveGuildSchedulingSettings(interaction.guildId!, cadence, firstSurveyDate, launchTime.time, launchTime.timeZone, defaultDeadline, splitWeekendSlots);
    await interaction.reply({ content: `Saved ${cadence} defaults beginning ${firstSurveyDate} at ${launchTime.time} (${launchTime.timeZone}); availability closes ${defaultDeadline} after launch and weekend splitting is ${splitWeekendSlots ? "on" : "off"}.`, ephemeral: true });
  } catch (error) {
    await interaction.reply({ content: error instanceof Error ? error.message : "Could not save scheduling defaults.", ephemeral: true });
  }
}

/** Reports the current round and its responders to an administrator. */
async function handleRoundStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  try {
    const round = await findOpenPlanningRound(interaction.guildId!);
    if (round === null) return void await interaction.editReply("There is no open planning round for this server.");
    const responses = await findAvailabilityResponses(round._id);
    const responderNames = await Promise.all(responses.map(async (response) => {
      try {
        return (await interaction.guild!.members.fetch(response.userId)).displayName;
      } catch {
        return `Unknown member (${response.userId})`;
      }
    }));
    const title = round.title ?? "Board-game Scheduling";
    const availabilityStatus = round.deadlineProcessedAt === null
      ? `Open until <t:${Math.floor(round.deadline.getTime() / 1000)}:R>`
      : `Closed; selected slot: **${round.selectedSlot ?? "none"}**`;
    await interaction.editReply(`**${title}**\n${availabilityStatus}\nSlots: ${round.candidateSlots.map((slot) => slot.value).join(", ")}\nAvailability responses (${responses.length}): ${responderNames.join(", ") || "none"}`);
  } catch {
    await interaction.editReply("Could not retrieve the current planning round.");
  }
}

/** Creates a round immediately, using configured defaults when optional inputs are omitted. */
async function handleCreateRound(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });
    const settings = await findGuildSchedulingSettings(interaction.guildId!);
    if (settings === null) throw new Error("Run /round initialize-settings before creating a round for this server.");
    const deadlineDuration = interaction.options.getString("deadline") ?? settings.defaultDeadline;
    const daysAhead = interaction.options.getInteger("days-ahead") ?? daysForCadence(settings.cadence);
    const splitWeekendSlots = interaction.options.getBoolean("split-weekends") ?? settings.splitWeekendSlots;
    const round = await createPlanningRound({
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      title: interaction.options.getString("title") ?? undefined,
      deadline: parseDeadline(deadlineDuration),
      slots: generateRoundSlots(new Date(), daysAhead, splitWeekendSlots),
    });
    if (interaction.channel === null || !interaction.channel.isSendable()) throw new Error("Run this command in a text channel.");
    await interaction.channel.send(buildAvailabilityMessage(round));
    await interaction.editReply(`Created round \`${round._id}\` and posted its availability menu.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the round.";
    if (interaction.deferred) await interaction.editReply(message);
    else await interaction.reply({ content: message, ephemeral: true });
  }
}

/** Shows the irreversible wipe confirmation only to the administrator who requested it. */
async function handleRoundWipeRequest(interaction: ChatInputCommandInteraction): Promise<void> {
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
}

/** Completes or cancels the administrator-only `/round wipe` confirmation. */
export async function handleRoundWipeButton(interaction: ButtonInteraction): Promise<void> {
  const isConfirm = interaction.customId.startsWith(wipeConfirmPrefix);
  const isCancel = interaction.customId.startsWith(wipeCancelPrefix);
  if (!isConfirm && !isCancel) return;
  const [guildId, requestingUserId] = interaction.customId.slice((isConfirm ? wipeConfirmPrefix : wipeCancelPrefix).length).split(":");
  if (interaction.guildId !== guildId || interaction.user.id !== requestingUserId) {
    await interaction.reply({ content: "Only the administrator who requested this wipe can confirm it.", ephemeral: true });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: "You need the Manage Server permission to wipe rounds.", ephemeral: true });
    return;
  }
  if (isCancel) return void await interaction.update({ content: "Wipe cancelled.", components: [] });
  await interaction.deferUpdate();
  try {
    const deletedCount = await wipeGuildRounds(guildId);
    await interaction.editReply({ content: `Deleted ${deletedCount} planning round${deletedCount === 1 ? "" : "s"} and their availability responses.`, components: [] });
  } catch {
    await interaction.editReply({ content: "Could not wipe this server's rounds.", components: [] });
  }
}
