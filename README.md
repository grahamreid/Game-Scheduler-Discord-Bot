# Board Game Scheduler

A Discord bot for organizing recurring board-game nights. The current milestone
sets up the typed SQLite persistence layer and a local simulator; Discord
interactions are the next milestone.

## Local setup

Requirements: Node.js 18 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run simulate
npm test
```

The default database is `data/board-game-scheduler.db`. It is ignored by Git.
The simulator persists a sample guild and planning round, then prints the
stored round and its candidate dates. It is deliberately Discord-free so it
can later become the deterministic multi-member test harness.

## Project documentation

- [Architecture and data model](docs/architecture.md)
- [Decisions and deferred work](docs/decisions-and-backlog.md)

## Database deployment strategy

Use SQLite for local development, integration tests, and the simulator. For
AWS deployment, use PostgreSQL (for example Amazon RDS) rather than relying on
a container-local SQLite file. The TypeScript types come from Drizzle ORM and
are available with either database; repository interfaces keep the eventual
database adapter change contained.
