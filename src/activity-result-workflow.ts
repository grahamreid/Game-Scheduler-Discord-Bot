/** Tallies a single activity poll for its results announcement or session reminder. */
import { findActivitiesByIds, findEligibleActivityBallots } from "./db/activity-polls";
import type { RoundActivityPoll } from "./types";

/** Current ballot counts and per-activity totals for one poll. */
export interface ActivityTotals {
  attendeeCount: number;
  ballotCount: number;
  activityTallies: Array<{ name: string; votes: number }>;
}

/** Counts votes for the current candidates, including candidates with zero votes. */
export async function getPollResults(poll: RoundActivityPoll): Promise<ActivityTotals> {
  const [activities, ballots] = await Promise.all([
    findActivitiesByIds(poll.guildId, poll.candidateActivityIds),
    findEligibleActivityBallots(poll.roundId, poll.eligibleUserIds),
  ]);
  const votesByActivityId = new Map<string, number>();
  for (const ballot of ballots) {
    for (const activityId of ballot.activityIds) {
      votesByActivityId.set(activityId, (votesByActivityId.get(activityId) ?? 0) + 1);
    }
  }
  return {
    attendeeCount: poll.eligibleUserIds.length,
    ballotCount: ballots.length,
    activityTallies: activities
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ _id, name }) => ({ name, votes: votesByActivityId.get(_id) ?? 0 })),
  };
}
