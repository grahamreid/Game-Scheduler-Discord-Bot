import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { guilds } from "../../infrastructure/database/schema";
import { openDatabase } from "../../infrastructure/database/connection";
import { applyMigrations } from "../../infrastructure/database/migrate";
import { SqlitePlanningRoundRepository } from "../../infrastructure/database/sqlite-planning-round-repository";

async function main(): Promise<void> {
  const databasePath = resolve(process.env.DATABASE_PATH ?? "data/board-game-scheduler.db");
  mkdirSync(dirname(databasePath), { recursive: true });
  const { sqlite, db } = openDatabase(databasePath);
  applyMigrations(sqlite);

  const now = new Date();
  const guildId = "simulation-guild";
  db.insert(guilds).values({
    id: guildId,
    defaultChannelId: "simulation-channel",
    timezone: "America/New_York",
    createdAt: now.toISOString(),
  }).onConflictDoNothing().run();

  const repository = new SqlitePlanningRoundRepository(db);
  const roundId = randomUUID();
  const round = await repository.create({
    id: roundId,
    guildId,
    channelId: "simulation-channel",
    title: "Simulated board-game night",
    availabilityClosesAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    candidateDates: [
      { id: randomUUID(), date: "2026-12-04", displayOrder: 1 },
      { id: randomUUID(), date: "2026-12-05", displayOrder: 2 },
    ],
  });

  console.log(JSON.stringify({ round, candidateDates: await repository.listCandidateDates(roundId) }, null, 2));
  sqlite.close();
}

void main();
