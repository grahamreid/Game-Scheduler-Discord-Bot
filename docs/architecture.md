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

1. An administrator creates an `open` round with possible event dates and an
   overall deadline.
2. Members select every date that works for them. Activity suggestions/votes
   and host volunteering can be collected during the same `open` period.
3. At the deadline, the scheduler counts availability. A tie selects the
   chronologically earlier date.
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
  availabilityResponses: [ { userId, dates, submittedAt } ],
  candidateDates: [ { date } ],
  selectedDate, selectedHostUserId, finalizedAt, createdAt, updatedAt

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

`candidateDates` and `availabilityResponses` are embedded in their round
because they only belong to that round and are always read with it. This
preserves dates with zero votes and keeps each member's one-time availability
response together with the poll it answered. Other collections remain separate
because they will be updated independently by many Discord members.

Dates such as an event day are `YYYY-MM-DD` strings in the guild's timezone.
Deadlines and audit fields are MongoDB `Date` values, which represent UTC
instants.

## Deadline processing

`schedule:process` is an idempotent, manually runnable deadline processor. It
finds `open` rounds whose `deadline` has passed and have no
`deadlineProcessedAt` yet, then counts each member's one-time availability
response.

Availability responses are the source of truth, rather than a counter embedded
in `candidateDates`. Each Discord member interacts individually with the same
bot message, so the bot receives a separate interaction. The MVP accepts one
immutable submission per member; counts are calculated when the deadline
closes. With a small group this is inexpensive and preserves the data needed for
attendance and host eligibility.

- Three or more members available on one or more dates: save the most popular
  date, choosing the earlier date when counts tie, and set `deadlineProcessedAt`.
- Fewer than three members on every date: cancel the round.

## Local verification

Either native MongoDB Community Server or Docker Compose runs MongoDB locally.
The simulator uses the connection string from `.env`, which works with either
choice. MongoDB Atlas M0 is the intended initial production option; it has a
free tier suitable for this bot.
