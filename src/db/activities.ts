/**
 * Stores reusable activity names and calculates their small-guild history on
 * demand. Stored counters are unnecessary until activity history grows large.
 */
import type { Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import type { Activity, ActivityVote, PlanningRound, RoundActivityPoll } from "../types";
import { getDatabase } from "./mongo";

const maxActivitiesPerUser = 1_000;

export interface ActivityHistoryEntry {
  activity: Activity;
  proposalRate: number | null;
  popularityRate: number | null;
  pollCount: number;
}

async function activities(): Promise<Collection<Activity>> {
  return (await getDatabase()).collection<Activity>("activities");
}

/** Collapses case and repeated whitespace for exact guild-local deduplication. */
export function normalizeActivityName(name: string): string {
  // \s+ matches all whitespace, /g replaces all occurrences, not just ths first
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Finds an exact normalized activity name or creates it for the guild. */
export async function findOrCreateActivity(guildId: string, name: string, userId: string): Promise<Activity> {
  // done both here and in normalizeActivityName because the verbatim name from the user
  // should still be sanitized even if we're applying a similar kind of normalization for deduplication.
  const trimmedName = name.trim().replace(/\s+/g, " ");
  if (trimmedName.length === 0) throw new Error("Activity suggestion cannot be empty.");

  const normalizedName = normalizeActivityName(trimmedName);
  const catalog = await activities();

  // Count by creator across all guilds. At the cap, a missing name cannot be inserted.
  const createdCount = await catalog.countDocuments({ createdByUserId: userId });
  // A match is returned unchanged. $setOnInsert supplies fields only when
  // no name matches and upsert is enabled.
  const activity = await catalog.findOneAndUpdate(
    { guildId, normalizedName },
    {
      $setOnInsert: {
        _id: randomUUID(),
        name: trimmedName,
        createdByUserId: userId,
        createdAt: new Date(),
      },
    },
    {
      upsert: createdCount < maxActivitiesPerUser,
      // Has to be "after" because otherwise if there's no match it will return
      // the pre-upsert document, which is null (ie result from no match)
      returnDocument: "after",
    },
  );
  if (activity === null) {
    // TODO: Unit test
    throw new Error(`You can create up to ${maxActivitiesPerUser} activity names across all servers. You can still suggest an existing name in this server.`);
  }
  return activity;
}

/** Clears the guild's activity data and removes deleted candidates from existing polls. */
export async function wipeGuildActivities(guildId: string): Promise<number> {
  const database = await getDatabase();
  const activities = database.collection<Activity>("activities");
  const [activityIds, roundIds] = await Promise.all([
    activities.distinct("_id", { guildId }),
    database.collection<PlanningRound>("planningRounds").distinct("_id", { guildId }),
  ]);
  const activityRecords = {
    $or: [{ roundId: { $in: roundIds } }, { activityId: { $in: activityIds } }],
  };

  // A previous round wipe can leave activity records that only the activity IDs identify.
  await database.collection("activitySuggestions").deleteMany(activityRecords);
  await database.collection("activityVotes").deleteMany(activityRecords);
  await database.collection<RoundActivityPoll>("roundActivityPolls").updateMany(
    { candidateActivityIds: { $in: activityIds } },
    { $pull: { candidateActivityIds: { $in: activityIds } } },
  );
  const result = await activities.deleteMany({ guildId, _id: { $in: activityIds } });
  return result.deletedCount;
}

/** Lists statistics of activities with optional search capability. */
export async function findActivityHistory(guildId: string, search: string): Promise<ActivityHistoryEntry[]> {
  const normalizedSearch = normalizeActivityName(search);
  const database = await getDatabase();
  const [allActivities, roundIds] = await Promise.all([
    database.collection<Activity>("activities").find({ guildId }).toArray(),
    database.collection<PlanningRound>("planningRounds").distinct("_id", { guildId }),
  ]);
  const matchedActivities = allActivities
    .filter((activity) => activity.normalizedName.includes(normalizedSearch))
    .sort((left, right) => left.name.localeCompare(right.name));

  const polls = await database.collection<RoundActivityPoll>("roundActivityPolls")
    .find({ roundId: { $in: roundIds } }).toArray();
  const votes = await database.collection<ActivityVote>("activityVotes")
    .find({ roundId: { $in: polls.map((poll) => poll.roundId) } }).toArray();

  return matchedActivities.map((activity) => {
    const pollsContainingActivity = polls.filter((poll) => poll.candidateActivityIds.includes(activity._id));

    // needed both to prevent division by zero and to avoid counting polls with no eligible voters in the popularity average
    const pollsWithEligibleVoters = pollsContainingActivity.filter((poll) => poll.eligibleUserIds.length > 0);

    const popularityTotal = pollsWithEligibleVoters.reduce((total, poll) => {
      // get the vote count for this activity in this poll
      const voteCount = votes.filter((vote) => vote.roundId === poll.roundId && vote.activityId === activity._id).length;
      // fraction of eligible voters who voted for this activity
      // summing this fraction across all polls and then dividing by the number of polls gives 
      // the average popularity rate for this activity across all polls it was in.
      return total + voteCount / poll.eligibleUserIds.length;
    }, 0);
    return {
      activity,
      proposalRate: polls.length === 0 ? null : pollsContainingActivity.length / polls.length,
      popularityRate: pollsWithEligibleVoters.length === 0 ? null : popularityTotal / pollsWithEligibleVoters.length,
      pollCount: pollsContainingActivity.length,
    };
  });
}
