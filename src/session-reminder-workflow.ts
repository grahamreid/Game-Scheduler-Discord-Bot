/** Selects sessions due for a reminder and gathers their attendance and activity totals. */
import { getPollResults, type ActivityTotals } from "./activity-result-workflow";
import { findActivityPoll } from "./db/activity-polls";
import { findAvailabilityResponses } from "./db/availability-responses";
import { findGuildSchedulingSettings } from "./db/guild-scheduling-settings";
import { findRoundsAwaitingReminder, type PlanningRoundDocument } from "./db/planning-rounds";
import { getLocalCalendarDate } from "./slot-generation";

/** Details for one reminder in the round's original channel. */
export interface SessionReminder {
  round: PlanningRoundDocument;
  eventDate: string;
  attendingUserIds: string[];
  activityTotals: ActivityTotals | null;
}

/** Finds sessions whose guild has reached noon on the day before the event. */
export async function getDueSessionReminders(now = new Date()): Promise<SessionReminder[]> {
  const reminders: SessionReminder[] = [];
  // toISOString uses UTC. A guild can be a day behind UTC, so its tomorrow is at least this date.
  const upcomingRounds = await findRoundsAwaitingReminder(now.toISOString().slice(0, 10));

  for (const round of upcomingRounds) {
    const eventDate = round.eventDate!;
    const { surveyTimeZone } = (await findGuildSchedulingSettings(round.guildId))!;
    const reminderDate = new Date(`${eventDate}T00:00:00Z`);
    reminderDate.setUTCDate(reminderDate.getUTCDate() - 1);
    if (getLocalCalendarDate(now, surveyTimeZone) !== reminderDate.toISOString().slice(0, 10)) continue;
    const guildHour = new Intl.DateTimeFormat("en-US", {
      timeZone: surveyTimeZone, hour: "numeric", hourCycle: "h23",
    }).format(now);
    if (Number(guildHour) < 12) continue;

    const [responses, poll] = await Promise.all([findAvailabilityResponses(round._id), findActivityPoll(round._id)]);
    // Attendance still comes from the winning slot after an admin changes the event date.
    const attendingUserIds = responses
      .filter(({ slots }) => slots.includes(round.selectedSlot!))
      .map(({ userId }) => userId);
    const activityTotals = poll === null || poll.candidateActivityIds.length === 0 ? null : await getPollResults(poll);
    reminders.push({ round, eventDate, attendingUserIds, activityTotals });
  }

  return reminders;
}
