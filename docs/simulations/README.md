# Simulation scenarios

This folder will contain repeatable, manual end-to-end validation instructions.
Each scenario should include:

1. Required setup, including local MongoDB and environment variables.
2. The commands to run and the hypothetical member actions to perform.
3. The expected console/Discord result.
4. MongoDB `mongosh` queries to confirm persisted data.

The current foundation check is:

Start MongoDB using either native MongoDB Community Server or Docker Compose:

```powershell
docker compose up -d
```

Then run:

```powershell
npm run db:init
npm run simulate
```

Then inspect the created document with:

```powershell
mongosh "mongodb://127.0.0.1:27017/board-game-scheduler" --eval "db.planningRounds.find().pretty()"
```

If `mongosh` is not installed locally and you chose Docker, use:

```powershell
docker compose exec mongo mongosh board-game-scheduler --eval "db.planningRounds.find().pretty()"
```
