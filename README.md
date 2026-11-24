# Board Game Scheduler

A Discord bot for organizing recurring board-game scheduling. The current milestone
sets up MongoDB persistence and a local simulator; Discord interactions are the
next milestone.

## Local setup

Requirements: Node.js 18 or newer, npm, and one local MongoDB option below.

### Option A: native MongoDB Community Server

Install MongoDB Community Server for your operating system from the [MongoDB
download page](https://www.mongodb.com/try/download/community). On Windows,
use the MSI and select **Install MongoD as a Service**. On macOS, use MongoDB's
macOS installation instructions or Homebrew. Install `mongosh` separately if
you want an interactive terminal; it is not bundled with MongoDB Server.

### Option B: Docker Compose

If Docker is available, run:

```powershell
docker compose up -d
```

Both options expose MongoDB only on `127.0.0.1:27017` and use the same `.env`
connection string. Stop Docker MongoDB with `docker compose down`; use
`docker compose down --volumes` only when you want to erase its local data.

### Start the app's local setup

```powershell
# PowerShell
Copy-Item .env.example .env
```

```sh
# macOS/Linux shell
cp .env.example .env
```

```sh
npm install
npm run db:init
npm run simulate
```

The simulator persists a sample planning round and prints it. It is deliberately
Discord-free so it can later become the deterministic multi-member test harness.

## Project documentation

- [Architecture and data model](docs/architecture.md)
- [Decisions and deferred work](docs/decisions-and-backlog.md)

## Database deployment strategy

Use either native MongoDB Community Server or Docker Compose locally, and
MongoDB Atlas M0 in production.
Keeping the same database technology in both environments is intentional: this
is a small MVP and does not need a database abstraction layer.

## Validation approach

This MVP deliberately uses simulations and manual end-to-end checks instead of
unit tests. As each workflow is built, its repeatable validation steps will be
added to `docs/simulations/` so you can run and inspect the same scenarios.
