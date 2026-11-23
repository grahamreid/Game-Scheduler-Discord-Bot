# Codebase guide

This guide explains the current project for someone new to Node.js, TypeScript,
and Discord bots. It describes what exists today; later milestones will add more
files alongside these foundations.

## Top-level files and folders

| Path | Purpose |
| --- | --- |
| `package.json` | The Node project manifest: its scripts are the commands you run and its dependency lists identify downloaded libraries. |
| `package-lock.json` | Records the exact installed dependency versions so another computer gets the same dependency tree. Do not edit it by hand. |
| `tsconfig.json` | TypeScript compiler settings, including strict type checking. |
| `.env.example` | Safe template for local configuration. Copy it to `.env`; `.env` is intentionally not committed because it may later contain secrets. |
| `.gitignore` | Tells Git not to track generated dependencies, local databases, or secrets. |
| `README.md` | The short local setup and command guide. |
| `data/` | Created locally when migrations run. It holds the ignored SQLite database file. |
| `docs/` | Human-facing project decisions and design explanations. |
| `tests/` | Automated checks. These do not run against Discord. |
| `src/` | Application source code. TypeScript is compiled/run by Node tooling. |

## `src` layout

```text
src/
  app/                 # application-facing contracts and future use cases; abstracts away db logic, etc
  domain/              # business vocabulary and rules, independent of Discord/DB
  infrastructure/      # concrete technical integrations, currently SQLite
  presentation/        # ways a person/system invokes the app, currently CLI
  scripts/             # small maintenance programs such as database migration
  index.ts             # eventual normal application entry point
```

### Current files

| File | Purpose |
| --- | --- |
| `src/domain/rounds/types.ts` | Defines `PlanningRound`, `CandidateDate`, and legal round states. These types describe the business data without deciding how it is stored or displayed. |
| `src/app/ports/clock.ts` | Defines a clock contract. Tests can later provide a fake time while production uses the real system clock. |
| `src/app/ports/planning-round-repository.ts` | Defines the database operations required by round-related application logic. A *repository* is an object that reads/writes a particular kind of business data while hiding database mechanics. |
| `src/infrastructure/database/schema.ts` | Drizzle's typed representation of each SQLite table and its indexes/keys. It helps TypeScript catch misspelled columns and invalid query shapes. |
| `src/infrastructure/database/migrations/0001_initial.sql` | The first database change. A migration is versioned SQL that builds the tables in an empty database. Future schema changes receive new, numbered migration files rather than modifying this one. |
| `src/infrastructure/database/connection.ts` | Opens SQLite and exposes both the raw connection and Drizzle's typed query API. |
| `src/infrastructure/database/migrate.ts` | Finds unapplied SQL migrations and records them in the database's `schema_migrations` table. |
| `src/infrastructure/database/sqlite-planning-round-repository.ts` | The SQLite implementation of the planning-round repository contract. It is deliberately named `Sqlite...` because it is only one possible implementation. |
| `src/scripts/migrate.ts` | The program run by `npm run db:migrate`; it creates the local data directory and applies migrations. |
| `src/presentation/cli/simulate.ts` | A local, Discord-free smoke-test program. It saves a sample round and prints it. This will grow into multi-user workflow simulation. |
| `src/index.ts` | Placeholder main entry point for the future Discord bot process. |
| `tests/integration/database.test.ts` | Verifies that an empty SQLite database migrates and can persist a planning round with candidate dates. |

## TypeScript terms used here

- A `type` names a set of allowed values. `RoundStatus`, for example, prevents
  accidental statuses such as `"done-ish"`.
- An `interface` describes the required shape of an object. It is checked while
  coding, then erased when the program runs.
- A `class` is a recipe for creating objects with data and behavior.
- `implements` means a class promises to satisfy an interface. This lets
  `SqlitePlanningRoundRepository` be replaced later without changing code that
  depends on the repository contract.
- `async`/`Promise` describe an operation that may finish later, such as a
  future network database call. SQLite happens to execute these calls locally
  and quickly, but keeping the contract asynchronous avoids a redesign later.

## Inspecting the local SQLite database

The easiest graphical option on Windows is **DB Browser for SQLite**: open
`data/board-game-scheduler.db`, then use its **Browse Data** or **Execute SQL**
tabs. Close the app before running a migration that changes the database.

If the `sqlite3` command-line tool is installed, run this from the project root:

```powershell
sqlite3 data/board-game-scheduler.db
```

Inside the SQLite prompt, useful commands are:

```sql
.tables
.schema planning_rounds
SELECT * FROM planning_rounds;
SELECT * FROM round_candidate_dates ORDER BY display_order;
SELECT * FROM schema_migrations;
```

Exit with `.quit`. The database stores timestamps as UTC ISO-8601 text and
dates as `YYYY-MM-DD`, so the query results are directly readable.

## Cloud deployment options

For the expected five hours of activity every week or two, a permanently
running container and database are unnecessary. Discord interactions can be
received over HTTP rather than a persistent gateway connection, so an AWS
Lambda behind API Gateway can handle commands and message components. EventBridge
Scheduler can invoke another Lambda at the availability deadline to post the
result.

- **Recommended for the lowest idle cost:** Lambda + API Gateway + EventBridge
  Scheduler + DynamoDB on-demand. DynamoDB bills requests/storage rather than
  provisioned idle database capacity, but its data model requires a dedicated
  repository adapter and key design.
- **Recommended if relational SQL is more valuable than minimum operations:**
  Lambda + Aurora Serverless v2 PostgreSQL. Current supported Aurora versions
  can be configured with a zero-ACU minimum and auto-pause, although storage
  and related AWS charges remain and wake-up latency must be accepted.

We will choose between these at deployment time, before writing the production
adapter. Local SQLite remains the fastest development experience either way.
