/**
 * Handles the administrator-only `/round` commands and wipe confirmation.
 * Member-facing round controls live in round-post.ts.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  escapeMarkdown,
  MessageFlags,
  PermissionsBitField
} from "discord.js";
import { tallyAvailability } from "../availability";
import { findActivityVoterIds } from "../db/activity-polls";
import { getActivitySuggestions } from "../db/activity-suggestions";
import { findAvailabilityResponses } from "../db/availability-responses";
import { findGuildSchedulingSettings, saveGuildSchedulingSettings } from "../db/guild-scheduling-settings";
import { getDatabase } from "../db/mongo";
import { createPlanningRound, wipeGuildRounds, type PlanningRoundDocument } from "../db/planning-rounds";
import { daysForCadence, generateRoundSlots } from "../slot-generation";
import { buildRoundPost } from "./round-post";
import { parseCadence, parseCalendarDate, parseDeadline, parseSurveyLaunchTime } from "./command-parsers";
import { wipeCancelPrefix, wipeConfirmPrefix } from "./constants";

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
    case "status": return handleRoundStatus(interaction, interaction.guildId);
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
    const minimumAttendeeCount = interaction.options.getInteger("minimum-attendees", true);
    const splitWeekendSlots = interaction.options.getBoolean("split-weekends", true);
    await saveGuildSchedulingSettings(interaction.guildId!, cadence, firstSurveyDate, launchTime.time, launchTime.timeZone, defaultDeadline, minimumAttendeeCount, splitWeekendSlots);
    await interaction.reply({ content: `Saved ${cadence} defaults beginning ${firstSurveyDate} at ${launchTime.time} (${launchTime.timeZone}); availability closes ${defaultDeadline} after launch, ${minimumAttendeeCount} attendees are required, and weekend splitting is ${splitWeekendSlots ? "on" : "off"}.`, ephemeral: true });
  } catch (error) {
    console.error("/round initialize-settings failed:", error instanceof Error ? error.stack : String(error));
    await interaction.reply({ content: error instanceof Error ? error.message : "Could not save scheduling defaults.", ephemeral: true });
  }
}

/** Reports slot tallies and activity suggestions for the latest round. */
async function handleRoundStatus(interaction: ChatInputCommandInteraction, guildId: string): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const database = await getDatabase();
    const round = await database.collection<PlanningRoundDocument>("planningRounds")
      .findOne({ guildId }, { sort: { createdAt: -1 } });
    if (round === null) return void await interaction.editReply("There is no planning round for this server.");
    const [responses, suggestions, voterIds] = await Promise.all([
      findAvailabilityResponses(round._id),
      getActivitySuggestions(round._id, guildId),
      findActivityVoterIds(round._id),
    ]);
    const slotLines = tallyAvailability(round.candidateSlots, responses)
      .filter(({ votes }) => votes > 0)
      .map(({ slot, votes }) => {
        const winner = slot === round.selectedSlot ? " (winner)" : "";
        return `- ${escapeMarkdown(slot)} — ${votes} ${votes === 1 ? "vote" : "votes"}${winner}`;
      });
    const title = round.title ?? "Board-game Scheduling";
    const content = [
      `**${escapeMarkdown(title)}**`,
      "**Availability votes**",
      slotLines.join("\n") || "No slots selected yet.",
      "**Initial submission respondents**",
      responses.map(({ userId }) => `<@${userId}>`).join(", ") || "No one has submitted availability yet.",
      "**Activity suggestions**",
      suggestions.map((name) => `- ${escapeMarkdown(name)}`).join("\n") || "No activity suggestions yet.",
      "**Activity voters**",
      voterIds.map((userId) => `<@${userId}>`).join(", ") || "No activity ballots yet.",
    ].join("\n");
    await interaction.editReply({ content, allowedMentions: { parse: [] } });
    console.log(`/round status sent for round ${round._id}.`);
  } catch (error) {
    console.error("/round status failed:", error instanceof Error ? error.stack : String(error));
    await interaction.editReply("Could not retrieve the current planning round.");
  }
}

/** Creates a round immediately, using configured defaults when optional inputs are omitted. */
async function handleCreateRound(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });
    const settings = await findGuildSchedulingSettings(interaction.guildId!);
    if (settings === null) throw new Error("Run /round initialize-settings before creating a round for this server.");
    if (!Number.isSafeInteger(settings.minimumAttendeeCount) || settings.minimumAttendeeCount < 1) {
      throw new Error("Run /round initialize-settings again to configure a valid minimum attendee count.");
    }
    const deadlineDuration = interaction.options.getString("deadline") ?? settings.defaultDeadline;
    const daysAhead = interaction.options.getInteger("days-ahead") ?? daysForCadence(settings.cadence);
    const splitWeekendSlots = interaction.options.getBoolean("split-weekends") ?? settings.splitWeekendSlots;
    const slots = generateRoundSlots(new Date(), daysAhead, splitWeekendSlots);
    if (slots.length > 25) {
      throw new Error(`Those options produce ${slots.length} slots; Discord's current select menu supports at most 25. Use fewer days or do not split weekends.`);
    }
    const round = await createPlanningRound({
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      title: interaction.options.getString("title") ?? undefined,
      deadline: parseDeadline(deadlineDuration),
      minimumAttendeeCount: settings.minimumAttendeeCount,
      slots,
    });
    if (interaction.channel === null || !interaction.channel.isSendable()) throw new Error("Run this command in a text channel.");
    await interaction.channel.send(buildRoundPost(round));
    await interaction.editReply(`Created round \`${round._id}\` and posted its availability form button.`);
  } catch (error) {
    console.error("/round create failed:", error instanceof Error ? error.stack : String(error));
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
  } catch (error) {
    console.error("/round wipe failed:", error instanceof Error ? error.stack : String(error));
    await interaction.editReply({ content: "Could not wipe this server's rounds.", components: [] });
  }
}
