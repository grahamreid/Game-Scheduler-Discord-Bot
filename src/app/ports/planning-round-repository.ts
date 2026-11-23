import type { CandidateDate, PlanningRound } from "../../domain/rounds/types";

/** Data required to save a newly created planning round. */
export interface CreatePlanningRoundInput {
  id: string;
  guildId: string;
  channelId: string;
  title?: string;
  availabilityClosesAt: Date;
  candidateDates: Array<{ id: string; date: string; displayOrder: number }>;
}

/**
 * The database operations the application needs for planning rounds. A
 * repository hides storage details from business logic, allowing a SQLite,
 * PostgreSQL, or DynamoDB implementation to share this contract.
 */
export interface PlanningRoundRepository {
  create(input: CreatePlanningRoundInput): Promise<PlanningRound>;
  findById(id: string): Promise<PlanningRound | null>;
  listCandidateDates(roundId: string): Promise<CandidateDate[]>;
}
