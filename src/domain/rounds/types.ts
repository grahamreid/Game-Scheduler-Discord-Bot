/**
 * The few meaningful lifecycle states of a planning round. `open` deliberately
 * covers availability, activity discussion, and host volunteering at once.
 */
export type RoundStatus =
  | "open"
  | "availability_tiebreak"
  | "finalized"
  | "cancelled";

/** A date shown as an option in a round's availability poll. */
export interface CandidateDate {
  id: string;
  roundId: string;
  date: string;
  displayOrder: number;
}

/** The persisted state of one board-game-night planning process. */
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
