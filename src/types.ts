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

/** The supported intervals between planned events for one Discord guild. */
export type RoundCadence = "weekly" | "biweekly";

/** Per-guild settings used to generate dated availability slots. */
export interface GuildSchedulingSettings {
  guildId: string;
  cadence: RoundCadence;
  /** Calendar date of the first survey that automatic scheduling will create. */
  firstSurveyDate: string;
  /** Configured local clock time for future automated rounds. */
  surveyLaunchTime: string;
  /** IANA timezone derived from the administrator's friendly abbreviation. */
  surveyTimeZone: string;
  /** Duration from launch until the round's availability deadline, such as 7h. */
  defaultDeadline: string;
  /** Minimum members available for one slot before the round can proceed. */
  minimumAttendeeCount: number;
  splitWeekendSlots: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  /** Attendance threshold copied from guild settings when this round was opened. */
  minimumAttendeeCount: number;
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

/** A reusable, guild-scoped activity name, deduplicated by normalized spelling. */
export interface Activity {
  _id: string;
  guildId: string;
  name: string;
  normalizedName: string;
  createdByUserId: string;
  createdAt: Date;
}

/** One member's current activity suggestion for a planning round. */
export interface ActivitySuggestion {
  _id: string;
  roundId: string;
  userId: string;
  activityId: string;
  suggestedAt: Date;
}

/** Snapshot of the activity candidates and eligible voters for one closed availability poll. */
export interface RoundActivityPoll {
  _id: string;
  roundId: string;
  eligibleUserIds: string[];
  candidateActivityIds: string[];
  voteLimit: number;
  resultsPublishedAt: Date | null;
  createdAt: Date;
}

/** One member's vote for one candidate activity in a round. */
export interface ActivityVote {
  _id: string;
  roundId: string;
  userId: string;
  activityId: string;
  votedAt: Date;
}
