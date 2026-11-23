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

The same TypeScript code will connect to Docker MongoDB locally and MongoDB
Atlas after deployment; only `MONGODB_URI` changes.

## Round workflow

1. An administrator creates an `open` round with possible event dates and an
   availability deadline.
2. Members select every date that works for them. Activity suggestions/votes
   and host volunteering can be collected during the same `open` period.
3. At the deadline, the scheduler counts availability. A tie moves the round to
   `availability_tiebreak` and posts a single-choice follow-up poll.
4. The winning date, activity suggestions, and eligible least-recent host are
   announced. The round becomes `finalized`, or `cancelled` for insufficient
   turnout.

The complete status list is deliberately small: `open`,
`availability_tiebreak`, `finalized`, and `cancelled`.

## MongoDB collections

MongoDB uses collections of JSON-like documents rather than SQL tables.

```text
planningRounds
  id, guildId, channelId, status, title, availabilityClosesAt,
  candidateDates: [ { id, date, displayOrder } ],
  selectedDate, selectedHostUserId, finalizedAt, createdAt, updatedAt

availabilityResponses
  roundId, userId, candidateDateIds, submittedAt

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

`candidateDates` is embedded in its round because it only belongs to that round
and is always shown with it. This preserves dates with zero votes and gives the
tie-break poll an authoritative option list. Other collections remain separate
because each will be updated independently by many Discord members.

Dates such as an event day are `YYYY-MM-DD` strings in the guild's timezone.
Deadlines and audit fields are MongoDB `Date` values, which represent UTC
instants.

## Local verification

Docker Compose starts a local MongoDB instance. The simulator and integration
test use the connection string from `.env`, which points to this local service
by default. MongoDB Atlas M0 is the intended initial production option; it has
a free tier suitable for this small bot.
