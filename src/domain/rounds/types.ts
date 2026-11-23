export type RoundStatus =
  | "draft"
  | "availability_open"
  | "availability_tiebreak"
  | "activities_open"
  | "hosting_open"
  | "finalized"
  | "cancelled";

export interface CandidateDate {
  id: string;
  roundId: string;
  date: string;
  displayOrder: number;
}

export interface PlanningRound {
  id: string;
  guildId: string;
  channelId: string;
  status: RoundStatus;
  title: string | null;
  availabilityClosesAt: Date | null;
  selectedDate: string | null;
  selectedHostUserId: string | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
