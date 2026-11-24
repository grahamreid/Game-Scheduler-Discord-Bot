# Board Game Scheduler architecture

## MVP approach

This project uses MongoDB directly. It intentionally does not have a generic
database abstraction or repository layer: this is a small, single-purpose bot
and MongoDB is the selected production database as well as the local one.

```text
Discord interaction or local simulator
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
  _id, guildId, channelId, status, title, deadline, deadlineProcessedAt,
  candidateSlots: [ { value } ],
  selectedSlot, selectedHostUserId, finalizedAt, createdAt, updatedAt

guildSchedulingSettings
  guildId, cadence, firstSurveyDate, surveyLaunchTime, surveyTimeZone, defaultDeadline,
  splitWeekendSlots, createdAt, updatedAt

availabilityResponses
  roundId, userId, slots, submittedAt

activities
  id, guildId, displayName, createdByUserId,
  firstSuggestedAt, lastSuggestedAt, selectedCount

activityVotes
  roundId, userId, activityIds, votedAt

activityProposals
  roundId, userId, activityId, proposedAt

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

Dates such as an event day are `YYYY-MM-DD` strings in the guild's timezone.
Deadlines and audit fields are MongoDB `Date` values, which represent UTC
instants.

## Deadline processing

`schedule:process` is an idempotent, manually runnable deadline processor. It
finds `open` rounds whose `deadline` has passed and have no
`deadlineProcessedAt` yet, then counts each member's current availability
response.

Availability responses are the source of truth, rather than a counter embedded
in `candidateSlots`. Each Discord member interacts individually with the same
bot message, so the bot receives a separate interaction. A member can submit
again before the deadline, replacing their current answer. Counts are calculated
when the deadline closes. With a small group this is inexpensive and preserves
the data needed for attendance and host eligibility.

- Three or more members available in one or more slots: save the most popular
  slot, choosing the alphabetically earlier slot when counts tie, and set
  `deadlineProcessedAt`.
- Fewer than three members in every slot: cancel the round.

## Local verification

Either native MongoDB Community Server or Docker Compose runs MongoDB locally.
The simulator uses the connection string from `.env`, which works with either
choice. MongoDB Atlas M0 is the intended initial production option; it has a
free tier suitable for this bot.
