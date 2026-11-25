/**
 * Starts the local Discord Gateway bot. This is deliberately the one process
 * that owns Discord connection lifecycle; command behavior lives in src/discord.
 */
import { Client, Events, GatewayIntentBits } from "discord.js";
import "dotenv/config";
import { ensureDatabaseIndexes } from "./db/setup";
import { handleAdminRoundCommand, handleRoundWipeButton } from "./discord/admin-round-commands";
import { handleAvailabilityMenu } from "./discord/availability-menu";
import { activityCommand, handleActivityCommand } from "./discord/activity-commands";
import { handleActivitySuggestionModal } from "./discord/activity-suggestion-modal";
import { roundCommand } from "./discord/round-command-definition";
import { startLocalRoundCloser } from "./scheduling/local-round-closer";

const token = process.env.DISCORD_TOKEN;
const testGuildId = process.env.DISCORD_TEST_GUILD_ID;
if (token === undefined || testGuildId === undefined) {
  throw new Error("DISCORD_TOKEN and DISCORD_TEST_GUILD_ID are required. See docs/private-discord-test-setup.md.");
}

function localRoundCloserInterval(): number {
  const configuredInterval = process.env.ROUND_CLOSER_INTERVAL_MS;
  if (configuredInterval === undefined) return 60_000;
  const interval = Number(configuredInterval);
  if (!Number.isSafeInteger(interval) || interval < 1_000) {
    return 60_000
  }
  return interval;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (readyClient) => {
  await ensureDatabaseIndexes();
  const guild = await readyClient.guilds.fetch(testGuildId);
  await guild.commands.set([roundCommand.toJSON(), activityCommand.toJSON()]);
  console.log(`Logged in as ${readyClient.user.tag}; test-guild commands registered.`);
  if (process.env.ENABLE_LOCAL_ROUND_CLOSER === "true") {
    const interval = localRoundCloserInterval();
    startLocalRoundCloser(readyClient, interval);
    console.log(`Local round closer enabled; checking every ${interval}ms.`);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "round") {
    await handleAdminRoundCommand(interaction);
  } else if (interaction.isChatInputCommand() && interaction.commandName === "activity") {
    await handleActivityCommand(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleAvailabilityMenu(interaction);
  } else if (interaction.isModalSubmit()) {
    await handleActivitySuggestionModal(interaction);
  } else if (interaction.isButton()) {
    await handleRoundWipeButton(interaction);
  }
});

void client.login(token);
