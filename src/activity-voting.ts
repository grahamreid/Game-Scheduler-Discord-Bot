/** Builds activity polls from the finalized attendance list and validates ballots. */
import { randomUUID } from "node:crypto";
import { findActivitiesByIds, findActivityPoll, saveActivityBallot, saveActivityPoll } from "./db/activity-polls";
import { findEligibleSuggestionIds } from "./db/activity-suggestions";
import { findGuildSchedulingSettings } from "./db/guild-scheduling-settings";
import { findPlanningRound } from "./db/planning-rounds";
import { getLocalCalendarDate } from "./slot-generation";
import type { Activity, RoundActivityPoll } from "./types";

const maxActivityChoices = 25; // Maximum options in a Discord string select.

/** A poll and its choices in ballot order. */
export interface ActivityPollChoices {
  poll: RoundActivityPoll;
  choices: Activity[];
}

/** Creates the poll snapshot when the selected slot has at least one suggestion. */
export async function prepareActivityPoll(
  roundId: string,
  guildId: string,
  eligibleUserIds: string[],
  now: Date,
): Promise<ActivityPollChoices | null> {
  const suggestionIds = await findEligibleSuggestionIds(roundId, eligibleUserIds);
  const choices = (await findActivitiesByIds(guildId, suggestionIds))
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, maxActivityChoices);
  // Nobody attending may have suggested a game, or the catalog may have been wiped.
  if (choices.length === 0) return null;
  const poll: RoundActivityPoll = {
    _id: randomUUID(),
    roundId,
    guildId,
    eligibleUserIds,
    candidateActivityIds: choices.map((activity) => activity._id),
    voteLimit: Math.ceil(eligibleUserIds.length / 2),
    resultsPublishedAt: null,
    createdAt: now,
  };
  await saveActivityPoll(poll);
  return { poll, choices };
}

/** Checks guild ownership, attendee eligibility, and the session-day cutoff. */
export async function getOpenActivityPoll(
  roundId: string,
  guildId: string | null,
  userId: string,
  now = new Date(),
): Promise<RoundActivityPoll> {
  const [round, poll] = await Promise.all([findPlanningRound(roundId), findActivityPoll(roundId)]);
  // A member can click an old poll after its round or activity choices were wiped.
  if (round === null || round.guildId !== guildId || round.status !== "finalized"
    || poll === null || poll.candidateActivityIds.length === 0) {
    throw new Error("Activity voting is unavailable for this round.");
  }
  if (!poll.eligibleUserIds.includes(userId)) {
    throw new Error("Only members available for the selected slot can vote.");
  }
  // Round creation requires guild settings, and finalization sets the event date.
  const { surveyTimeZone } = (await findGuildSchedulingSettings(round.guildId))!;
  const eventDate = round.eventDate!;
  // Slots describe a date and part of day. Accept votes through that local date.
  if (getLocalCalendarDate(now, surveyTimeZone) > eventDate) {
    throw new Error("Activity voting has ended for this session.");
  }
  return poll;
}

/** Saves one current ballot containing only valid, non-duplicate choices. */
export async function submitActivityBallot(poll: RoundActivityPoll, userId: string, activityIds: string[]): Promise<void> {
  const candidates = new Set(poll.candidateActivityIds);
  if (activityIds.length === 0 || activityIds.length > poll.voteLimit) {
    throw new Error(`Choose between 1 and ${poll.voteLimit} activities.`);
  }
  if (new Set(activityIds).size !== activityIds.length || activityIds.some((id) => !candidates.has(id))) {
    throw new Error("Choose distinct activities from this poll.");
  }
  await saveActivityBallot({ roundId: poll.roundId, userId, activityIds, votedAt: new Date() });
}
