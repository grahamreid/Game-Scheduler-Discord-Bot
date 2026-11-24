# Set up a private Discord test server and bot

This guide completes the first three checklist items for local development.
The bot will run on your own computer; you do not need a public URL, port
forwarding, or cloud deployment for this gateway-based test setup.

## Before you start

You need a Discord account, your local MongoDB setup, and Node.js/npm. Keep
your bot token private: it is equivalent to this bot's password. Store it only
in the ignored `.env` file, never in Git, screenshots, chat messages, or a
public document.

## 1. Create a private Discord server

In the Discord desktop app or browser:

1. In the server list on the left, select the **Add a Server** (`+`) button.
2. Choose **Create My Own**.
3. Choose **For me and my friends**.
4. Name it something unambiguous, such as `Board Game Scheduler Test`, then
   select **Create**.
5. Create a text channel named `board-game-test`. This will be the bot's test
   channel.
6. Keep the server private: do not share its invite link beyond anyone you
   intentionally want to use for testing.

Discord documents the same server-creation flow in its [server creation
guide](https://support.discord.com/hc/en-us/articles/204849977-How-do-I-create-a-server).

### Enable Developer Mode and copy the server ID

1. Open **User Settings** → **Advanced**.
2. Enable **Developer Mode**.
3. Right-click the test server's icon and choose **Copy Server ID**.
4. Save this value temporarily; it becomes `DISCORD_TEST_GUILD_ID` in step 3.

Discord calls this value a server or guild ID. [Official ID
instructions](https://support-dev.discord.com/hc/en-us/articles/360028717192-Where-can-I-find-my-Application-Team-Server-ID)

## 2. Create the application and bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select **New Application**.
3. Name it `Board Game Scheduler Test` and create it.
4. On **General Information**, copy the **Application ID**. This becomes
   `DISCORD_APPLICATION_ID` in step 3. It is an identifier, not a secret.
5. Open the **Bot** tab and select **Add Bot** if Discord has not already
   created one for the application.
6. To make the bot private, first open the **Installation** tab and set the
   **Default Install Link** to **None**. Then return to the **Bot** tab and
   leave **Public Bot** turned **off**. Discord requires this because a private
   application cannot advertise a default authorization link. This keeps other
   Discord users from inviting the bot to their servers; you, as the app owner,
   can still invite it to your own private test server.
7. Under the bot token section, select **Reset Token** or **Copy** as offered,
   then copy the token immediately into your local `.env` file in step 3.
   Discord will not show the full token again.
8. Do not enable privileged Gateway Intents for this initial implementation.
   Slash commands and message components do not require Message Content intent.

## Invite the bot to the private server

1. In the Developer Portal, open **OAuth2** → **URL Generator**.
2. Under **Scopes**, select:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, select:
   - **View Channels**
   - **Send Messages**
   - **Embed Links** (optional now, but useful when the bot starts posting
     formatted announcements)
4. Copy the generated URL, open it in a browser, select your test server, and
   authorize it.
5. Confirm that the bot appears in the private server's member list.

Do not grant **Administrator**, **Manage Server**, **Manage Roles**, **Manage
Channels**, **Manage Messages**, or any moderation permissions. They are not
needed for the MVP. Members need the channel-level **Use Application Commands**
permission to invoke slash commands; it is normally enabled by default.

Guild-scoped application commands are the correct testing mode: Discord makes
them available immediately in that guild. [Discord application-command
documentation](https://docs.discord.com/developers/docs/interactions/slash-commands)

## 3. Configure the local `.env` file

From the project root, create `.env` if it does not exist:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux, use:

```sh
cp .env.example .env
```

Open `.env` and fill in only these Discord values:

```dotenv
DISCORD_TOKEN=paste-the-bot-token-here
DISCORD_APPLICATION_ID=paste-the-application-id-here
DISCORD_TEST_GUILD_ID=paste-the-server-id-here
```

Leave `MONGODB_URI` pointing at your chosen local MongoDB setup. Do not commit
`.env`; the project's `.gitignore` already excludes it.

## What comes next

The next implementation slice will add command registration and a local bot
process. At that point you will run `npm run dev`, use `/round create` in the
private server, and test the availability menu in `#board-game-test`.

## First command test

After the bot code is installed, run this from the project root:

```powershell
npm run dev
```

The process connects outward to Discord's Gateway; it is not an HTTP server and
does not need a public URL. In `#board-game-test`, a member with **Manage
Server** can run:

```text
/round create deadline:1h title:Test round
```

The command replies privately with the newly created round ID and posts a shared
availability menu in the channel. Each member may select one or more slots and
re-submit before the deadline; their confirmation is visible only to them.

Before creating recurring-style rounds, an administrator can save the guild's
defaults (the first date is for future automated creation; manual creation uses
today as its survey date):

```text
/round initialize-settings cadence:biweekly first-survey-date:2026-12-03 survey-launch-time:5:00 PM ET default-deadline:7h minimum-attendees:3 split-weekends:True
```

Then a minimal manual round is:

```text
/round create
```

It offers the Monday after today through the following Sunday for weekly
cadence, or through the second Sunday for biweekly cadence. Use the optional
`days-ahead` (1–25) and `split-weekends` arguments to override those defaults
for one round. The current Discord select menu permits at most 25 total slot
options, so a weekend split may reduce the usable maximum range.

The launch-time setting accepts these common US abbreviations and stores their
IANA equivalents for a future scheduler: `ET`/`EST`/`EDT` → `America/New_York`,
`CT`/`CST`/`CDT` → `America/Chicago`, `MT`/`MST`/`MDT` → `America/Denver`, and
`PT`/`PST`/`PDT` → `America/Los_Angeles`.
