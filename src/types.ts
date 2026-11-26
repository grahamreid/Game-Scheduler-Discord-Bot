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

/** How a member prefers to join a session. */
export type VenuePreference = "in-person" | "virtual";

/** Formats the opening post offers before the winning slot is known. */
export type RoundVenuePolicy = "in-person" | "either";

/** Preferences a Discord member saves for future rounds in one guild. */
export interface MemberPreferences {
  guildId: string;
  userId: string;
  venue?: VenuePreference;
}

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
  /** Scheduled local calendar date, initially taken from the winning slot. */
  eventDate: string | null;
  /** Event date for which the bot has already sent a reminder. */
  reminderSentForDate?: string;
  /** A Discord user ID for an in-person host, "virtual" for an online session, or null when no host is assigned. */
  host: string | null;
  venuePolicy: RoundVenuePolicy;
  /** Members who prefer virtual for this round, initialized from saved preferences when it opens. */
  virtualPreferenceUserIds: string[];
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One member's latest multi-select availability response for a round. */
export interface AvailabilityResponse {
  roundId: string;
  userId: string;
  slots: string[];
  /** Whether the member volunteered to host this in-person session. */
  canHost?: boolean;
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

/** Candidate and eligible-voter snapshot for activity discussion after availability closes. */
export interface RoundActivityPoll {
  _id: string;
  roundId: string;
  /** Lets a guild wipe remove this poll even if its round is already gone. */
  guildId: string;
  eligibleUserIds: string[];
  candidateActivityIds: string[];
  voteLimit: number;
  /** Set after the full vote totals are successfully posted. */
  resultsPublishedAt: Date | null;
  createdAt: Date;
}

/** A member's current ballot. Replacing it is a single database write. */
export interface ActivityVote {
  roundId: string;
  userId: string;
  activityIds: string[];
  votedAt: Date;
}
