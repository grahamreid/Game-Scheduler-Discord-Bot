# Decisions and backlog

## Confirmed decisions

- TypeScript and discord.js are the implementation platform.
- MongoDB is used directly for both local development and the initial cloud
  deployment. MongoDB Atlas M0 is the intended MVP database.
- Local MongoDB supports either native MongoDB Community Server or Docker
  Compose; both use the same local connection string.
- The code intentionally has no generic database abstraction/repository layer.
- The MVP uses manual end-to-end validation through the private Discord server.
  Unit tests will be added later for programmatic validation.
- Availability is multi-select and uses the round's scheduled deadline. A
  member may reopen and resubmit their form before the deadline. Their latest
  response replaces their earlier one.
- Creating a newer planning round automatically cancels any earlier active
  round in the same guild.
- The most popular slot wins. A tie selects the alphabetically earlier slot.
- Activity suggestions are non-binding discussion input; do not automatically
  select an activity winner.
- Each member may submit one optional free-text activity suggestion in the
  availability form. The name enters the searchable catalog immediately. Only
  selected-slot attendees' suggestions become candidates for that round.
- Activity names are deduplicated case-insensitively within a guild. More
  sophisticated consolidation remains deferred; provide administrative cleanup
  later if needed.
- Eligible attendees may vote for up to `ceil(attendeeCount / 2)` candidates.
  Ballots can be revised through the event date in the guild's timezone. The
  bot posts one snapshot when all eligible attendees vote or the guild reaches
  the day before the event, whichever comes first.
- `/activity history` privately searches prior activity names and calculates
  proposal and popularity statistics from all activity polls in the guild.
- `/activity wipe` requires Manage Server permission and private confirmation.
  It clears the guild's activity catalog and suggestions. It removes the deleted
  IDs from polls and ballots, which can remain with no choices. Planning rounds
  and availability responses are kept.
- A selected host must volunteer and be available on the selected date. Among
  eligible volunteers, choose the least-recent host.
- `/round wipe` is administrator-only, confirms through a private Discord
  button, and deletes the current guild's rounds along with their availability
  responses, activity suggestions, polls, and ballots. It keeps the guild's
  activity catalog.
- Guild scheduling settings support `weekly` and `biweekly` cadence, a first
  automated-survey date/time, a default availability deadline, and an optional
  weekend Afternoon/Evening split. They also define the minimum number of
  available attendees required for a slot to win. Manual round creation starts
  immediately.
- Local development can opt into availability closing and scheduled activity
  results through `ENABLE_LOCAL_ROUND_CLOSER=true`. Production will use an
  external trigger.

## Implementation sequence

1. Add manual controls for closing a round and testing date-based behavior.
   Validate the existing activity voting flow in the private Discord server,
   then add the second activity totals post.
2. Collect host volunteers in the initial form, select a host using attendance
   and hosting history, and include the host and location in the round result.
3. Add session format preferences and use them to decide how attendees meet.
4. Configure the scheduling channel, automate recurring round creation, and
   send day-before reminders for upcoming sessions.
5. Validate the full flow in the private server, then deploy with an external
   scheduler and roll it out to the real server. EventBridge, Lambda, and API
   Gateway remain AWS options.

The [TODO list](../TODO) holds the implementation details, manual checks, and
deferred ideas. Validate each step in the private server as it lands.

## Deferred scheduling design

- Monthly cadence needs a calendar rule such as the same day of the month or
  the nth weekday, a rule for months where that date is unavailable, and the
  guild timezone. The weekly and biweekly schedules use fixed day intervals.
- The current US abbreviations map to IANA zones. Add other regions or allow
  direct IANA zone selection when needed.

## Private-server setup

- [Private test-server and bot setup](private-discord-test-setup.md)
