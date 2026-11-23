import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { guilds } from "../../src/infrastructure/database/schema";
import { openDatabase } from "../../src/infrastructure/database/connection";
import { applyMigrations } from "../../src/infrastructure/database/migrate";
import { SqlitePlanningRoundRepository } from "../../src/infrastructure/database/sqlite-planning-round-repository";

describe("SQLite persistence", () => {
  const directories: string[] = [];

  afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

  it("migrates an empty database and persists a round with zero-vote candidate dates", async () => {
    const directory = mkdtempSync(join(tmpdir(), "board-game-scheduler-"));
    directories.push(directory);
    const { sqlite, db } = openDatabase(join(directory, "test.db"));
    applyMigrations(sqlite);
    db.insert(guilds).values({
      id: "guild-1",
      defaultChannelId: "channel-1",
      timezone: "America/New_York",
      createdAt: "2026-11-22T00:00:00.000Z",
    }).run();

    const repository = new SqlitePlanningRoundRepository(db);
    try {
      await repository.create({
        id: "round-1",
        guildId: "guild-1",
        channelId: "channel-1",
        availabilityClosesAt: new Date("2026-11-23T05:00:00.000Z"),
        candidateDates: [
          { id: "date-1", date: "2026-11-27", displayOrder: 1 },
          { id: "date-2", date: "2026-11-28", displayOrder: 2 },
        ],
      });
      expect(await repository.findById("round-1")).toMatchObject({ status: "open", selectedDate: null });
      expect(await repository.listCandidateDates("round-1")).toHaveLength(2);
    } finally {
      sqlite.close();
    }
  });
});
