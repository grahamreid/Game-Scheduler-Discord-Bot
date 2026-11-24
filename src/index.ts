/**
 * Starts the local Discord Gateway bot. This is deliberately the one process
 * that owns Discord connection lifecycle; command behavior lives in src/discord.
 */
import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { ensureDatabaseIndexes } from "./db/setup";
import { handleAdminRoundCommand, handleRoundWipeButton } from "./discord/admin-round-commands";
import { handleAvailabilityMenu } from "./discord/availability-menu";
import { roundCommand } from "./discord/round-command-definition";

const token = process.env.DISCORD_TOKEN;
const testGuildId = process.env.DISCORD_TEST_GUILD_ID;
if (token === undefined || testGuildId === undefined) {
  throw new Error("DISCORD_TOKEN and DISCORD_TEST_GUILD_ID are required. See docs/private-discord-test-setup.md.");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (readyClient) => {
  await ensureDatabaseIndexes();
  const guild = await readyClient.guilds.fetch(testGuildId);
  await guild.commands.set([roundCommand.toJSON()]);
  console.log(`Logged in as ${readyClient.user.tag}; test-guild commands registered.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "round") {
    await handleAdminRoundCommand(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleAvailabilityMenu(interaction);
  } else if (interaction.isButton()) {
    await handleRoundWipeButton(interaction);
  }
});

void client.login(token);
