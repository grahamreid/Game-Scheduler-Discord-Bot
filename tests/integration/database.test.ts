import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../../src/db/mongo";
import { createPlanningRound, findPlanningRound } from "../../src/db/planning-rounds";
import { ensureDatabaseIndexes } from "../../src/db/setup";

describe("MongoDB persistence", () => {
  afterEach(async () => {
    await (await getDatabase()).collection("planningRounds").deleteMany({ guildId: "test-guild" });
    await closeDatabase();
  });

  it("persists an open round with zero-vote candidate dates", async () => {
    await ensureDatabaseIndexes();
    try {
      const created = await createPlanningRound({
        guildId: "test-guild",
        channelId: "channel-1",
        availabilityClosesAt: new Date("2026-11-23T05:00:00.000Z"),
        candidateDates: [
          { date: "2026-11-27", displayOrder: 1 },
          { date: "2026-11-28", displayOrder: 2 },
        ],
      });
      expect(await findPlanningRound(created.id)).toMatchObject({ status: "open", selectedDate: null });
      expect(created.candidateDates).toHaveLength(2);
    } finally {
      // `afterEach` removes records and closes the shared client.
    }
  });
});
