# Board Game Scheduler

A Discord bot for organizing recurring board-game nights. The current milestone
sets up MongoDB persistence and a local simulator; Discord interactions are the
next milestone.

## Local setup

Requirements: Node.js 18 or newer and npm.

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npm run db:init
npm run simulate
npm test
```

The local database runs in Docker. The simulator persists a sample planning
round and prints it. It is deliberately Discord-free so it can later become the
deterministic multi-member test harness. Stop MongoDB with `docker compose down`
(its data is retained); use `docker compose down --volumes` only when you want
to erase the local database.

## Project documentation

- [Architecture and data model](docs/architecture.md)
- [Decisions and deferred work](docs/decisions-and-backlog.md)

## Database deployment strategy

Use MongoDB locally through Docker and in production through MongoDB Atlas M0.
Keeping the same database technology in both environments is intentional: this
is a small MVP and does not need a database abstraction layer.
