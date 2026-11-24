/**
 * Shared data shapes for the entire app. This stays separate from database and
 * Discord code so both can agree on a planning round's structure.
 */
export type RoundStatus =
  | "open"
  | "finalized"
  | "cancelled";

/** A free-form option shown in a round's availability poll. */
export interface CandidateSlot {
  value: string;
}

/** The persisted state of one board-game scheduling process. */
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
  selectedSlot: string | null;
  selectedHostUserId: string | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One member's latest multi-select availability response for a round. */
export interface AvailabilityResponse {
  roundId: string;
  userId: string;
  slots: string[];
  submittedAt: Date;
}

/** The number of available members for one candidate date. */
export interface AvailabilityTally {
  slot: string;
  votes: number;
}
