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
| `docker-compose.yml` | Starts a local MongoDB container with persistent Docker-managed storage. |
| `.gitignore` | Tells Git not to track generated dependencies, data, or secrets. |
| `README.md` | The short setup and run guide. |
| `docs/` | Project decisions and human-facing technical explanations. |
| `tests/` | Automated checks; the integration test uses local Docker MongoDB. |
| `src/` | Application source code. |

## `src` layout

```text
src/
  db/                 # MongoDB connection, indexes, and direct collection helpers
  domain/             # business vocabulary such as planning-round types
  presentation/       # entry points for people/systems, currently a CLI simulator
  scripts/            # maintenance programs, currently database initialization
  index.ts            # eventual normal Discord application entry point
```

### Current files

| File | Purpose |
| --- | --- |
| `src/domain/rounds/types.ts` | Defines planning-round data and legal states without deciding how it is displayed. |
| `src/db/mongo.ts` | Opens/reuses the MongoDB connection from `MONGODB_URI`. |
| `src/db/planning-rounds.ts` | Direct database functions for creating and finding planning rounds. Candidate dates are embedded in the round document. |
| `src/db/setup.ts` | Creates indexes that make ID and deadline lookups efficient. |
| `src/scripts/init-database.ts` | Program run by `npm run db:init`; ensures the indexes exist. |
| `src/presentation/cli/simulate.ts` | Discord-free smoke test that writes and prints a sample round. |
| `src/index.ts` | Placeholder main entry point for the future Discord interaction handler. |
| `tests/integration/database.test.ts` | Verifies MongoDB can persist and retrieve a round. |

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

Once Docker is running, open an interactive MongoDB shell:

```powershell
docker compose exec mongo mongosh -u boardgame -p boardgame-dev-password --authenticationDatabase admin board-game-scheduler
```

Useful MongoDB commands:

```javascript
show collections
db.planningRounds.find().pretty()
db.planningRounds.find({ status: "open" })
db.planningRounds.getIndexes()
```

Exit with `exit`. MongoDB Compass is the graphical alternative: connect using
the `MONGODB_URI` value in your `.env` file.

## Deployment

Use MongoDB Atlas M0 for the MVP. It is a free shared cluster with 512 MB of
storage, suitable for this small group. A later AWS deployment can use Lambda,
API Gateway, and EventBridge Scheduler while continuing to use the same Atlas
connection URI. Moving to a paid Atlas tier or a different database is deferred
until the bot has proven its needs.
