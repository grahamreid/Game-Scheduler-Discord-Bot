/** Stores each round's activity poll and one replaceable ballot per voter. */
import type { Activity, ActivityVote, RoundActivityPoll } from "../types";
import { getDatabase } from "./mongo";

/** Records the candidate and eligible-voter snapshot once per round. */
export async function saveActivityPoll(poll: RoundActivityPoll): Promise<void> {
  const database = await getDatabase();
  await database.collection<RoundActivityPoll>("roundActivityPolls").updateOne(
    { roundId: poll.roundId },
    { $setOnInsert: poll },
    { upsert: true },
  );
}

/** Looks up the snapshot when a member votes. */
export async function findActivityPoll(roundId: string): Promise<RoundActivityPoll | null> {
  const database = await getDatabase();
  return database.collection<RoundActivityPoll>("roundActivityPolls").findOne({ roundId });
}

/** Removes the guild's polls, including any whose rounds are already gone. */
export async function deleteGuildActivityPolls(guildId: string): Promise<void> {
  const database = await getDatabase();
  await database.collection<RoundActivityPoll>("roundActivityPolls").deleteMany({ guildId });
}

/** Finds a round's poll if it still has choices and no complete results post. */
export async function findUnpublishedActivityPoll(roundId: string): Promise<RoundActivityPoll | null> {
  const database = await getDatabase();
  return database.collection<RoundActivityPoll>("roundActivityPolls").findOne({
    roundId,
    resultsPublishedAt: null,
    candidateActivityIds: { $ne: [] },
  });
}

/** Loads the names of suggested activities from the guild's activity catalog. */
export async function findActivitiesByIds(guildId: string, activityIds: string[]): Promise<Activity[]> {
  const database = await getDatabase();
  return database.collection<Activity>("activities").find({ guildId, _id: { $in: activityIds } }).toArray();
}

/** Replaces the whole ballot so resubmitting cannot leave behind older selections. */
export async function saveActivityBallot(ballot: ActivityVote): Promise<void> {
  const database = await getDatabase();
  const { roundId, userId, activityIds, votedAt } = ballot;
  await database.collection<ActivityVote>("activityVotes").updateOne(
    { roundId, userId },
    { $set: { activityIds, votedAt } },
    { upsert: true },
  );
}

/** Loads the latest ballot from each eligible attendee who voted. */
export async function findEligibleActivityBallots(roundId: string, eligibleUserIds: string[]): Promise<ActivityVote[]> {
  const database = await getDatabase();
  return database.collection<ActivityVote>("activityVotes").find({ roundId, userId: { $in: eligibleUserIds } }).toArray();
}

/** Records when the result announcement was successfully sent. */
export async function markActivityResultsPublished(roundId: string, publishedAt: Date): Promise<void> {
  const database = await getDatabase();
  await database.collection<RoundActivityPoll>("roundActivityPolls").updateOne(
    { roundId, resultsPublishedAt: null },
    { $set: { resultsPublishedAt: publishedAt } },
  );
}

/** Lists members who have submitted a ballot for the round. */
export async function findActivityVoterIds(roundId: string): Promise<string[]> {
  const database = await getDatabase();
  return database.collection<ActivityVote>("activityVotes").distinct("userId", { roundId });
}
