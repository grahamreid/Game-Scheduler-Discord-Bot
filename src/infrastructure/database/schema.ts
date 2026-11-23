import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const guilds = sqliteTable("guilds", {
  id: text("id").primaryKey(),
  defaultChannelId: text("default_channel_id"),
  timezone: text("timezone").notNull(),
  createdAt: text("created_at").notNull(),
});

export const planningRounds = sqliteTable("planning_rounds", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull().references(() => guilds.id),
  channelId: text("channel_id").notNull(),
  status: text("status").notNull(),
  title: text("title"),
  availabilityClosesAt: text("availability_closes_at"),
  selectedDate: text("selected_date"),
  selectedHostUserId: text("selected_host_user_id"),
  finalizedAt: text("finalized_at"),
  ...timestamps,
}, (table) => [index("planning_rounds_status_deadline_idx").on(table.status, table.availabilityClosesAt)]);

export const roundCandidateDates = sqliteTable("round_candidate_dates", {
  id: text("id").primaryKey(),
  roundId: text("round_id").notNull().references(() => planningRounds.id),
  candidateDate: text("candidate_date").notNull(),
  displayOrder: integer("display_order").notNull(),
}, (table) => [uniqueIndex("round_candidate_dates_round_date_unique").on(table.roundId, table.candidateDate)]);

export const availabilityResponses = sqliteTable("availability_responses", {
  roundId: text("round_id").notNull().references(() => planningRounds.id),
  userId: text("user_id").notNull(),
  candidateDateId: text("candidate_date_id").notNull().references(() => roundCandidateDates.id),
  submittedAt: text("submitted_at").notNull(),
}, (table) => [primaryKey({ columns: [table.roundId, table.userId, table.candidateDateId] })]);

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull().references(() => guilds.id),
  displayName: text("display_name").notNull(),
  createdByUserId: text("created_by_user_id"),
  firstSuggestedAt: text("first_suggested_at").notNull(),
  lastSuggestedAt: text("last_suggested_at").notNull(),
  selectedCount: integer("selected_count").notNull().default(0),
});

export const activityVotes = sqliteTable("activity_votes", {
  roundId: text("round_id").notNull().references(() => planningRounds.id),
  userId: text("user_id").notNull(),
  activityId: text("activity_id").notNull().references(() => activities.id),
  votedAt: text("voted_at").notNull(),
}, (table) => [primaryKey({ columns: [table.roundId, table.userId, table.activityId] })]);

export const activityProposals = sqliteTable("activity_proposals", {
  roundId: text("round_id").notNull().references(() => planningRounds.id),
  userId: text("user_id").notNull(),
  activityId: text("activity_id").notNull().references(() => activities.id),
  proposedAt: text("proposed_at").notNull(),
}, (table) => [primaryKey({ columns: [table.roundId, table.userId] })]);

export const hostingVolunteers = sqliteTable("hosting_volunteers", {
  roundId: text("round_id").notNull().references(() => planningRounds.id),
  userId: text("user_id").notNull(),
  volunteeredAt: text("volunteered_at").notNull(),
}, (table) => [primaryKey({ columns: [table.roundId, table.userId] })]);

export const hostingHistory = sqliteTable("hosting_history", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull().references(() => guilds.id),
  roundId: text("round_id").notNull().references(() => planningRounds.id),
  userId: text("user_id").notNull(),
  hostedOn: text("hosted_on").notNull(),
  recordedAt: text("recorded_at").notNull(),
}, (table) => [uniqueIndex("hosting_history_round_unique").on(table.roundId)]);

export const roundAnnouncements = sqliteTable("round_announcements", {
  id: text("id").primaryKey(),
  roundId: text("round_id").notNull().references(() => planningRounds.id),
  kind: text("kind").notNull(),
  discordMessageId: text("discord_message_id").notNull(),
  postedAt: text("posted_at").notNull(),
}, (table) => [uniqueIndex("round_announcements_round_kind_unique").on(table.roundId, table.kind)]);

export const schemaVersion = sql`1`;
