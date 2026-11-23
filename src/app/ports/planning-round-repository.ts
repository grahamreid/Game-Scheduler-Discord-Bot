import type { CandidateDate, PlanningRound } from "../../domain/rounds/types";

export interface CreatePlanningRoundInput {
  id: string;
  guildId: string;
  channelId: string;
  title?: string;
  availabilityClosesAt: Date;
  candidateDates: Array<{ id: string; date: string; displayOrder: number }>;
}

export interface PlanningRoundRepository {
  create(input: CreatePlanningRoundInput): Promise<PlanningRound>;
  findById(id: string): Promise<PlanningRound | null>;
  listCandidateDates(roundId: string): Promise<CandidateDate[]>;
}
