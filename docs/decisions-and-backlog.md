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
  bot posts complete totals when everyone votes. The noon reminder the day
  before the event also shows the totals available at that time.
- `/activity history` privately searches prior activity names and calculates
  proposal and popularity statistics from all activity polls in the guild.
- `/activity wipe` requires Manage Server permission and private confirmation.
  It clears the guild's activity catalog and suggestions. It removes the deleted
  IDs from polls and ballots, which can remain with no choices. Planning rounds
  and availability responses are kept.
- A selected host must volunteer and be available on the selected date. Among
  eligible volunteers, prefer first-time hosts and then the least recent host.
  The flexible venue picker offers hosting as an in-person choice. Rounds
  that are in person only ask about hosting directly. Hosting history comes
  from earlier finalized rounds in the same server.
- Members can read and save their server preference with `/preferences venue`.
  Each round records who preferred virtual at launch. Everyone else defaults
  to in person. Members can change their preselected choice inside the form
  when the round offers either format.
- After a virtual session, the next round offers only the in-person form.
  A round that offers either format becomes virtual if someone available for
  the winning slot prefers virtual. Any round with a winning slot falls back
  to virtual if it has no eligible host.
- `/round wipe` is administrator-only, confirms through a private Discord
  button, and deletes the current guild's rounds along with their availability
  responses, activity suggestions, polls, and ballots. It keeps the guild's
  activity catalog and member preferences.
- Guild scheduling settings support `weekly` and `biweekly` cadence, a first
  automated-survey date/time, a default availability deadline, and an optional
  weekend Afternoon/Evening split. They also define the minimum number of
  available attendees required for a slot to win. Manual round creation starts
  immediately.
- Administrators can run `/round close` to close the current open round early.
  It uses the same rules and channel announcements as scheduled closure.
- `/round set-event-date` lets administrators reschedule the latest round
  after it has been finalized.
  It updates the date used by activity voting and keeps the original winning
  slot as the availability result.
- Local development can opt into scheduled availability closing and session
  reminders through `ENABLE_LOCAL_ROUND_CLOSER=true`. Reminders
  are due at noon in the guild's timezone the day before the event.
  Production will use an external trigger.

## Implementation sequence

1. Validate noon reminders in the private server by moving a finalized test
   session to tomorrow and checking that the reminder uses the new date and
   posts once.
2. Validate hosting in the private Discord server and add location or joining
   details.
3. Validate the activity voting flow, including the complete totals post when
   the last ballot arrives after the reminder.
4. Configure the scheduling channel and automate recurring round creation.
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
