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
   overall deadline.
2. Members select every date that works for them. Activity suggestions/votes
   and host volunteering can be collected during the same `open` period.
3. At the deadline, the scheduler counts availability. A tie selects the
   alphabetically earlier slot.
4. The winning date, activity suggestions, and eligible least-recent host are
   announced. The round becomes `finalized`, or `cancelled` for insufficient
   turnout.

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
  minimumAttendeeCount, selectedSlot, eventDate, selectedHostUserId, finalizedAt, createdAt, updatedAt

guildSchedulingSettings
  guildId, cadence, firstSurveyDate, surveyLaunchTime, surveyTimeZone, defaultDeadline,
  minimumAttendeeCount, splitWeekendSlots, createdAt, updatedAt

availabilityResponses
  roundId, userId, slots, submittedAt

activities
  _id, guildId, name, normalizedName, createdByUserId, createdAt

activityVotes
  _id, roundId, userId, activityIds, votedAt

activitySuggestions
  _id, roundId, userId, activityId, suggestedAt

roundActivityPolls
  _id, roundId, eligibleUserIds, candidateActivityIds, voteLimit,
  resultsPublishedAt, createdAt

hostingVolunteers
  roundId, userId, volunteeredAt

hostingHistory
  roundId, guildId, userId, hostedOn, recordedAt

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
status reply lists who has voted.
Publishing totals when every eligible attendee has voted or the event is one
day away remains a separate step.

Dates such as an event day are `YYYY-MM-DD` strings in the guild's timezone.
Deadlines and audit fields are MongoDB `Date` values, which represent UTC
instants.

## Deadline processing

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
`ROUND_CLOSER_INTERVAL_MS` (30 seconds is useful for testing) to invoke the
same application workflow used by future production triggers. That workflow
closes the poll and prepares the selected attendees and activity choices. The
Discord layer posts the availability result and a separate activity poll when
there are eligible suggestions. Only the process that successfully closes a
round posts its messages. The manual `schedule:process` command processes
availability in MongoDB. Use the local Discord closer to test channel posts.

Production will not use this in-process timer. An external scheduler will call
the same reusable workflow.

## Local verification

Either native MongoDB Community Server or Docker Compose runs MongoDB locally.
The Discord bot uses the connection string from `.env`, which works with either
choice. MongoDB Atlas M0 is the intended initial production option; it has a
free tier suitable for this bot.
