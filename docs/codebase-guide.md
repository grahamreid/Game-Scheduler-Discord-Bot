# Codebase guide

This guide explains the current project for someone new to Node.js, TypeScript,
MongoDB, and Discord bots.

## Top-level files and folders

| Path | Purpose |
| --- | --- |
| `package.json` | Node project manifest. Its scripts are commands you run; dependencies are downloaded libraries. |
| `package-lock.json` | Exact dependency versions. Do not edit by hand. |
| `tsconfig.json` | TypeScript compiler settings, including strict type checking. |
| `.env.example` | Safe local-config template. Copy it to `.env`; the actual `.env` is ignored because it may contain secrets. |
| `docker-compose.yml` | One of two supported local MongoDB options; the other is native MongoDB Community Server. |
| `.gitignore` | Tells Git not to track generated dependencies, data, or secrets. |
| `README.md` | The short setup and run guide. |
| `docs/` | Project decisions and human-facing technical explanations. |
| `src/` | Application source code. |

## `src` layout

```text
src/
  db/                 # MongoDB connection, indexes, and direct collection helpers
  discord/            # command definitions and interaction handlers
  scheduling/         # reusable processing invoked by a command now and a scheduler later
  presentation/       # entry points for people/systems, currently a CLI simulator
  scripts/            # maintenance programs, currently database initialization
  types.ts            # shared application data types
  index.ts            # eventual normal Discord application entry point
```

### Current files

| File | Purpose |
| --- | --- |
| `src/types.ts` | Defines planning-round data and legal states without deciding how it is displayed. |
| `src/db/mongo.ts` | Opens/reuses the MongoDB connection from `MONGODB_URI`. |
| `src/db/planning-rounds.ts` | Direct database functions for creating, finding, and closing planning rounds, including their embedded candidate slots. |
| `src/db/availability-responses.ts` | Direct database functions for each member's current availability response; kept separate so a later submission can replace it. |
| `src/db/guild-scheduling-settings.ts` | Stores cadence, initial survey date/time and IANA timezone, deadline, and weekend-splitting defaults per Discord server. |
| `src/db/setup.ts` | Creates indexes that make ID and deadline lookups efficient. |
| `src/discord/constants.ts` | Holds Discord component-ID prefixes and the shared US-timezone abbreviation mapping. |
| `src/discord/command-parsers.ts` | Validates and normalizes slash-command text before an administrator handler writes data. |
| `src/discord/round-command-definition.ts` | Declares the `/round` command and its options for Discord's command picker. |
| `src/discord/admin-round-commands.ts` | Routes and handles administrator `/round` commands, including create, configuration, status, and destructive wipe confirmation. |
| `src/discord/availability-menu.ts` | Builds the shared slot menu and handles each member's individual selection. Kept separate because component interactions differ from slash commands. |
| `src/availability.ts` | Availability rules: validates current submissions, tallies selections, and chooses a winning slot. |
| `src/slot-generation.ts` | Calendar-only logic that turns a scheduled survey date and options into dated availability slot labels. Kept separate so manual and future automated round creation use identical rules. |
| `src/scheduling/close-round.ts` | Closes one round's availability and also offers a reusable loop for rounds whose deadlines have passed. |
| `src/scripts/init-database.ts` | Program run by `npm run db:init`; ensures the indexes exist. |
| `src/scripts/process-deadlines.ts` | Program run by `npm run schedule:process`; manually executes deadline processing. |
| `src/scripts/clear-simulations.ts` | Program run by `npm run db:clear-simulations`; deletes only simulator-created records. |
| `src/presentation/cli/simulate.ts` | Discord-free workflow simulation that writes responses, processes a deadline, and prints the result. |
| `src/index.ts` | Starts the local Discord Gateway bot and registers test-guild commands. It is a long-running bot process, not an HTTP server. |

## TypeScript terms used here

- A `type` names allowed values. `RoundStatus` prevents accidental values such
  as `"done-ish"`.
- An `interface` describes the fields an object must have. It is checked while
  coding and erased when JavaScript runs.
- A `class` is a recipe for objects with data and behavior. The current MongoDB
  MVP does not need custom classes.
- `async`/`Promise` describe work that completes later, such as a network
  database request.

## Inspecting the local MongoDB database

With native MongoDB running or Docker Compose started, open an interactive
shell:

```powershell
mongosh "mongodb://127.0.0.1:27017/board-game-scheduler"
```

Useful MongoDB commands:

```javascript
show collections
db.planningRounds.find().pretty()
db.planningRounds.find({ status: "open" })
db.planningRounds.getIndexes()
```

Exit with `exit`. MongoDB Compass is the graphical alternative: connect using
the `MONGODB_URI` value in your `.env` file. `mongosh` is installed separately
from native MongoDB Server. When using Docker, run `docker compose exec mongo
mongosh board-game-scheduler` if `mongosh` is not installed on your computer.

## Deployment

Use MongoDB Atlas M0 for the MVP. It is a free shared cluster with 512 MB of
storage, suitable for this small group. A later AWS deployment can use Lambda,
API Gateway, and EventBridge Scheduler while continuing to use the same Atlas
connection URI. Moving to a paid Atlas tier or a different database is deferred
until the bot has proven its needs.

## Validation approach

We are intentionally not maintaining unit tests during the MVP. Instead, each
feature receives a manual end-to-end scenario in `docs/simulations/`. A
scenario will state the commands to run, the simulated members/actions, and the
MongoDB queries or Discord messages that demonstrate the expected result.
