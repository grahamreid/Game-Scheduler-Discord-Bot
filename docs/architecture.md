# Board Game Scheduler architecture

## MVP approach

This project uses MongoDB directly. It intentionally does not have a generic
database abstraction or repository layer: this is a small, single-purpose bot
and MongoDB is the selected production database as well as the local one.

```text
Discord interaction
                 |
                 v
       small application functions
                 |
                 v
        MongoDB collection helpers
                 |
                 v
      MongoDB locally / MongoDB Atlas in production
```

The same TypeScript code will connect to native MongoDB Community Server or
Docker Compose locally, and MongoDB Atlas after deployment. The local options
share the same `MONGODB_URI`.

## Round workflow

1. An administrator creates an `open` round with possible event slots and an
   overall deadline. The round records who currently prefers virtual.
2. Members select the slots that work for them, can suggest an activity, and
   can volunteer to host when responding in person.
3. At the deadline, the scheduler counts availability. A tie selects the
   alphabetically earlier slot.
4. The round becomes `finalized` with a winning slot and attendee list, or
   `cancelled` for insufficient turnout. Eligible suggestions get a separate
   activity poll. For an in-person session, the bot selects an available
   volunteer and includes them in the availability announcement.

The complete status list is deliberately small: `open`, `finalized`, and
`cancelled`.

Only one active (`open`) round is allowed per guild. Creating a newer round
automatically cancels the earlier active one. This keeps the channel and
scheduler focused on the current planning cycle.

## MongoDB collections

MongoDB uses collections of JSON-like documents rather than SQL tables.

```text
planningRounds
  _id, guildId, channelId, status, title, deadline,
  candidateSlots: [ { value } ],
  minimumAttendeeCount, selectedSlot, eventDate, reminderSentForDate, host, venuePolicy, virtualPreferenceUserIds,
  finalizedAt, createdAt, updatedAt

guildSchedulingSettings
  guildId, cadence, firstSurveyDate, surveyLaunchTime, surveyTimeZone, defaultDeadline,
  minimumAttendeeCount, splitWeekendSlots, createdAt, updatedAt

memberPreferences
  _id, guildId, userId, venue (optional)

availabilityResponses
  roundId, userId, slots, canHost, submittedAt

activities
  _id, guildId, name, normalizedName, createdByUserId, createdAt

activityVotes
  _id, roundId, userId, activityIds, votedAt

activitySuggestions
  _id, roundId, userId, activityId, suggestedAt

roundActivityPolls
  _id, roundId, guildId, eligibleUserIds, candidateActivityIds, voteLimit,
  resultsPublishedAt, createdAt

roundAnnouncements
  roundId, kind, discordMessageId, postedAt
```

`candidateSlots` are embedded in their round because they only belong to that
round and preserve slots with zero votes. `availabilityResponses` is separate:
each document is a member's current answer for one round, and its unique
`roundId` + `userId` index lets the bot replace that answer when the member
submits the menu again. Other collections remain separate because they will be
updated independently by many Discord members.

`guildSchedulingSettings` stores each server's `weekly` or `biweekly` cadence,
the calendar date on which future automated survey creation should begin, and
whether weekend days become separate Afternoon and Evening choices. It also
stores the future survey launch time and IANA timezone, plus its default
deadline duration (for example `7h`). Administrators provide a friendly common
US abbreviation such as `5:00 PM ET` or `17:00 CT`; the bot stores its mapped
IANA timezone (`America/New_York` or `America/Chicago`). A manual
round does not wait for that first date or launch time: `/round create` starts
immediately and treats the current day as its scheduled survey date, then
generates slots beginning on the following Monday. Its default range comes from
the configured cadence, but the command can override the range (from 1 to 25
days) and weekend split for that one round. If its `deadline` argument is omitted, it
uses the configured default deadline.

The setting also supplies `minimumAttendeeCount`: the number of members who
must be available in a single slot for a round to proceed. That number is
copied to the planning round at creation, so changing guild settings later does
not alter the outcome rule of an already-open poll.

Discord's current select menu can show at most 25 options. A weekend split adds
two choices for each weekend day, so manual creation rejects any requested
range that would exceed that limit.

Generated labels are date-first, such as `2026-11-30 (Monday)` or
`2026-12-05 (Saturday Afternoon)`, so alphabetical ordering is chronological.
Weekdays represent evenings implicitly; no time is assigned yet.

`/round create` is intentionally blocked until a guild has run
`/round initialize-settings`. Every round therefore has configured cadence,
weekend-splitting, and deadline defaults; per-round arguments may override
those values.

## Member preferences and hosting

`/preferences venue` shows the caller's current server preference privately.
Members can also pass `format: In person` or `format: Virtual` to update it.
The `memberPreferences` collection has one record per guild and member and can
hold additional preferences later. Round wipes preserve these records.

Each new round saves the user IDs that preferred virtual at launch in
`virtualPreferenceUserIds`. Members outside that list default to in person.
Changes to a saved server preference apply to future rounds. When either
format is allowed, **Submit availability** opens the form with the member's
current round preference preselected. The member can change it in the form.
Submitting the form adds or removes their ID from the round's virtual list.
On rounds that allow either format, members volunteer by choosing **In person
and I can host** in the venue picker. In-person-only rounds ask about hosting
directly. The form remembers the member's last answer. Choosing **Virtual**
withdraws any earlier hosting offer.

The opening post says which formats the round offers. If the most recently
finalized round in the guild was virtual, the next round offers only the
in-person form. Otherwise it offers either format. A round that offers either
format becomes virtual if any attendee available for the winning slot prefers
virtual. Both kinds of round fall back to virtual if nobody available for the
winning slot can host.

The host starts as `null`. Closing a successful round stores `"virtual"` for
an online session or the chosen host's Discord ID for an in-person session.
The bot considers only members who volunteered and selected the winning slot.
It gives first-time hosts priority, then picks the person with the earliest
last hosting date. Ties use ascending Discord user ID. Hosting history comes
from finalized rounds in the same guild with event dates before the new
session. `/round wipe` also removes hosting history because it is stored on the
rounds.

## Activity suggestions and discussion votes

The shared round post opens a private form with a multi-select for availability
and one optional free-text activity suggestion. The bot case-insensitively deduplicates
activity names within a guild and saves one current suggestion per member per
round. Once availability selects a slot, only suggestions from members
available for that slot become activity-poll candidates.

Each user can create up to 1,000 catalog entries across all guilds. Reusing a
name already in the guild's catalog uses no additional space in the quota.
Replacing a round suggestion leaves its previous name in the catalog, where
it still counts toward the creator's quota. The count and write are separate
operations, so simultaneous requests near the limit can exceed it.

Members can reopen the form to revise their response. The form preselects the
member's saved slots. Leaving the suggestion blank keeps the previous choice.

`/activity history` searches the guild's full catalog, including names added
during open rounds and names from cancelled rounds. Statistics use every
activity poll linked to a round in that guild, regardless of round status or
whether results have been published. Popularity can change as votes arrive.
Proposal rate is the percentage of those polls in which the activity was a
candidate. Popularity is the average share of eligible attendees who voted for
it in polls where it was a candidate.

`roundActivityPolls` stores the candidate and eligible-attendee snapshot for
activity discussion and history. A finalized round with eligible suggestions
gets a shared voting message. Members available for the selected slot can
choose up to half the attendee count rounded up. Resubmitting replaces their
entire ballot with one database write. The shared dropdown offers the first
25 distinct suggestions in alphabetical order.

The round stores the session date. Slots have no exact end time, so voting
stays open through that date using the guild's configured timezone. The admin
status reply lists who has voted. The bot posts complete totals once every
eligible attendee has submitted a ballot. The session reminder includes the
current totals when there is a poll. If it goes out with missing ballots,
complete totals can follow when the last ballot arrives by the end of the
event date. Both posts show the number of ballots received and the vote count
for every remaining candidate, including zero. Each saved ballot triggers the
complete results check for that round.

Dates such as an event day are `YYYY-MM-DD` strings in the guild's timezone.
Deadlines and audit fields are MongoDB `Date` values, which represent UTC
instants.

## Deadline processing

`/round close` lets an administrator close the server's current open round
before its deadline. It uses the same selection and announcement workflow as
the local timer. The result and any activity poll go to the round's original
channel. The administrator gets a private confirmation.

Administrators can use `/round set-event-date date:YYYY-MM-DD` to reschedule the
server's latest round after it has been finalized. The command replies
privately. `/round status` shows the current event date alongside the original
availability result, and activity voting uses the updated date in the guild's
timezone.

`schedule:process` is an idempotent, manually runnable deadline processor. It
finds `open` rounds whose `deadline` has passed, then counts each member's
current availability response. Submissions stop at the deadline even if the
scheduler has yet to process the round.

Availability responses are the source of truth, rather than a counter embedded
in `candidateSlots`. Each Discord member interacts individually with the same
bot message, so the bot receives a separate interaction. A member can submit
again before the deadline, replacing their current answer. Counts are calculated
when the deadline closes. With a small group this is inexpensive and preserves
the data needed for attendance and host eligibility.

- At least the round's configured minimum number of members available in one or
  more slots: save the most popular slot, choosing the alphabetically earlier
  slot when counts tie, and set the round to `finalized` with a `finalizedAt`
  timestamp.
- Fewer members than the configured minimum in every slot: cancel the round.

## Local poll closing

When `ENABLE_LOCAL_ROUND_CLOSER=true`, the local Discord process runs an
in-process timer. It checks immediately at startup and then at
`ROUND_CLOSER_INTERVAL_MS` (30 seconds is useful for testing) to close expired
availability polls and send session reminders. The Discord layer posts the
availability result and a separate activity poll when there are eligible
suggestions. Complete activity totals are triggered by the ballot handler.
The manual `schedule:process` command processes availability in MongoDB
without posting to Discord. Use the local Discord closer to test scheduled
channel posts.

Production will not use this in-process timer. An external scheduler will call
the same reusable workflow.

## Session reminders

The timer posts a reminder on its first check at or after noon on the day
before an event, using the guild's timezone. The message shows the current
event date, venue, host when assigned, and attendees from the winning slot.
It also includes the current activity totals when there is a poll. Sessions
without an activity poll still receive a reminder. The round stores the date
it was reminded for, so later checks skip that date and moving a round to a
new date lets it receive a new reminder. If the bot is offline the whole
afternoon and evening before the event, it misses that reminder.

## Local verification

Either native MongoDB Community Server or Docker Compose runs MongoDB locally.
The Discord bot uses the connection string from `.env`, which works with either
choice. MongoDB Atlas M0 is the intended initial production option; it has a
free tier suitable for this bot.
