import { asc, eq } from "drizzle-orm";
import type { CreatePlanningRoundInput, PlanningRoundRepository } from "../../app/ports/planning-round-repository";
import type { CandidateDate, PlanningRound, RoundStatus } from "../../domain/rounds/types";
import type { AppDatabase } from "./connection";
import { planningRounds, roundCandidateDates } from "./schema";

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function toRound(row: typeof planningRounds.$inferSelect): PlanningRound {
  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    status: row.status as RoundStatus,
    title: row.title,
    availabilityClosesAt: toDate(row.availabilityClosesAt),
    selectedDate: row.selectedDate,
    selectedHostUserId: row.selectedHostUserId,
    finalizedAt: toDate(row.finalizedAt),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

/**
 * SQLite-specific implementation of the storage contract. The name identifies
 * its database technology; callers should normally depend on
 * `PlanningRoundRepository`, not this concrete class.
 */
export class SqlitePlanningRoundRepository implements PlanningRoundRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreatePlanningRoundInput): Promise<PlanningRound> {
    const now = new Date().toISOString();
    this.db.transaction((tx) => {
      tx.insert(planningRounds).values({
        id: input.id,
        guildId: input.guildId,
        channelId: input.channelId,
        status: "open",
        title: input.title ?? null,
        availabilityClosesAt: input.availabilityClosesAt.toISOString(),
        selectedDate: null,
        selectedHostUserId: null,
        finalizedAt: null,
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.insert(roundCandidateDates).values(
        input.candidateDates.map((candidate) => ({
          id: candidate.id,
          roundId: input.id,
          candidateDate: candidate.date,
          displayOrder: candidate.displayOrder,
        })),
      ).run();
    });
    const created = await this.findById(input.id);
    if (created === null) throw new Error("Round was not created");
    return created;
  }

  async findById(id: string): Promise<PlanningRound | null> {
    const result = this.db.select().from(planningRounds).where(eq(planningRounds.id, id)).limit(1).all();
    return result[0] ? toRound(result[0]) : null;
  }

  async listCandidateDates(roundId: string): Promise<CandidateDate[]> {
    const rows = this.db.select().from(roundCandidateDates)
      .where(eq(roundCandidateDates.roundId, roundId))
      .orderBy(asc(roundCandidateDates.displayOrder)).all();
    return rows.map((row) => ({
      id: row.id,
      roundId: row.roundId,
      date: row.candidateDate,
      displayOrder: row.displayOrder,
    }));
  }
}
