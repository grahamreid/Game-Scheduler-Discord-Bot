/**
 * Shared data shapes for the entire app. This stays separate from database and
 * Discord code so both can agree on a planning round's structure.
 */
export type RoundStatus =
  | "open"
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
  /** MongoDB's built-in, indexed identifier for this round. */
  _id: string;
  guildId: string;
  channelId: string;
  status: RoundStatus;
  title: string | null;
  /** The current planning deadline; this MVP uses it to close availability. */
  deadline: Date;
  /** Set once the deadline has been processed into a selected day or cancellation. */
  deadlineProcessedAt: Date | null;
  /** Immutable, one-time availability submissions made by members for this round. */
  availabilityResponses: AvailabilityResponse[];
  selectedDate: string | null;
  selectedHostUserId: string | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One member's immutable, multi-select availability response. */
export interface AvailabilityResponse {
  userId: string;
  candidateDateIds: string[];
  submittedAt: Date;
}

/** The number of available members for one candidate date. */
export interface AvailabilityTally {
  candidateDateId: string;
  date: string;
  votes: number;
}
