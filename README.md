# Board Game Scheduler

A Discord bot for organizing recurring board-game scheduling. The current
milestone supports local MongoDB plus Discord-based end-to-end testing.

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
npm run dev
```

With the bot running, use the private Discord server setup guide and exercise
the workflow through Discord commands and menus.

## Project documentation

- [Architecture and data model](docs/architecture.md)
- [Decisions and deferred work](docs/decisions-and-backlog.md)

## Database deployment strategy

Use either native MongoDB Community Server or Docker Compose locally, and
MongoDB Atlas M0 in production.
Keeping the same database technology in both environments is intentional: this
is a small MVP and does not need a database abstraction layer.

## Validation approach

This MVP deliberately uses Discord-based end-to-end checks rather than local
simulation or unit tests. Unit tests can be added later for the business logic.
