/** Decides when activity-vote totals are ready to announce and prepares them. */
import { findActivitiesByIds, findEligibleActivityBallots, findUnpublishedActivityPolls } from "./db/activity-polls";
import { findGuildSchedulingSettings } from "./db/guild-scheduling-settings";
import { findPlanningRound } from "./db/planning-rounds";
import { getLocalCalendarDate } from "./slot-generation";

/** Vote totals and attendance counts for a round ready to be announced. */
interface ActivityResults {
  roundId: string;
  channelId: string;
  title: string | null;
  eventDate: string;
  attendeeCount: number;
  ballotCount: number;
  allAttendeesVoted: boolean;
  activityTallies: Array<{ name: string; votes: number }>;
}

/** Tallies unpublished polls once all attendees vote or the guild reaches the day before the event. */
export async function getPollResultsIfReady(
  roundId?: string,
  now = new Date(),
): Promise<ActivityResults[]> {
  const unpublishedPolls = await findUnpublishedActivityPolls(roundId);
  const dueResults: ActivityResults[] = [];

  for (const poll of unpublishedPolls) {
    const round = await findPlanningRound(poll.roundId);
    if (round === null) {
      throw new Error(`Activity poll ${poll._id} references missing round ${poll.roundId}.`);
    }

    const eligibleBallots = await findEligibleActivityBallots(round._id, poll.eligibleUserIds);
    const attendeeCount = poll.eligibleUserIds.length;
    // The unique index allows only one ballot per member in this round.
    const allAttendeesVoted = eligibleBallots.length === attendeeCount;
    // Activity polls are created only after the round has a selected slot and event date.
    const eventDate = round.eventDate!;
    if (!allAttendeesVoted) {
      const { surveyTimeZone } = (await findGuildSchedulingSettings(round.guildId))!;
      const today = getLocalCalendarDate(now, surveyTimeZone);
      if (today < dayBefore(eventDate)) continue;
    }

    const activities = await findActivitiesByIds(round.guildId, poll.candidateActivityIds);

    const votesByActivityId = new Map<string, number>();
    for (const ballot of eligibleBallots) {
      for (const activityId of ballot.activityIds) {
        votesByActivityId.set(activityId, (votesByActivityId.get(activityId) ?? 0) + 1);
      }
    }
    const activityTallies = activities
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ _id, name }) => ({ name, votes: votesByActivityId.get(_id) ?? 0 }));

    dueResults.push({
      roundId: round._id,
      channelId: round.channelId,
      title: round.title,
      eventDate,
      attendeeCount,
      ballotCount: eligibleBallots.length,
      allAttendeesVoted,
      activityTallies,
    });
  }

  return dueResults;
}

/** Returns the calendar date one day before a YYYY-MM-DD event date. */
function dayBefore(eventDate: string): string {
  const date = new Date(`${eventDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
