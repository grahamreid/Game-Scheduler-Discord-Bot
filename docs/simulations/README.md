# Simulation scenarios

This folder will contain repeatable, manual end-to-end validation instructions.
Each scenario should include:

1. Required setup, including local MongoDB and environment variables.
2. The commands to run and the hypothetical member actions to perform.
3. The expected console/Discord result.
4. MongoDB `mongosh` queries to confirm persisted data.

The current foundation check is:

```powershell
docker compose up -d
npm run db:init
npm run simulate
```

Then inspect the created document with:

```powershell
docker compose exec mongo mongosh -u boardgame -p boardgame-dev-password --authenticationDatabase admin board-game-scheduler --eval "db.planningRounds.find().pretty()"
```
