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
  Votes are discussion input, remain open until the event, and are published
  when all eligible attendees vote or one day before the event, whichever is
  first.
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
- Local development can opt into an in-process availability closer through
  `ENABLE_LOCAL_ROUND_CLOSER=true`; production will use an external trigger.

## Deferred Discord commands/features

| Idea | Notes |
| --- | --- |
| `/activity delete` | Administrative removal/hiding of unwanted or duplicate suggestions. |
| Reminder messages | Consider prompting members before a deadline. |
| Immediate round closure | Administrator command to close the current availability poll without waiting for its deadline. |
| Recurrence execution | Use configured cadence, first survey date/time, and timezone to create rounds automatically. |
| Upcoming-session reminders | Support multiple closed, future sessions and send a day-before reminder. |
| Virtual/in-person preferences | Define global member preference, per-round eligibility, and the rule that chooses format. |
| Monthly cadence | Requires an explicit calendar rule (for example, same day-of-month or nth weekday), behavior for months without that date, and a guild timezone. It cannot safely reuse the fixed 7/14-day calculation. |
| More timezone mappings | Initial setup maps ET/EST/EDT, CT/CST/CDT, MT/MST/MDT, and PT/PST/PDT to IANA zones. Add other regions or direct IANA-zone selection as needed. |
| AWS deployment | Lambda/API Gateway/EventBridge after local workflow is proven. |

## Implementation sequence

1. Publish activity vote totals when all eligible members have voted or one day before the event.
2. Host volunteering and host-history selection.
3. Complete final round closure and announcement, including activity discussion
   results and selected host.
4. Automated recurring round creation from guild scheduling settings.
5. Upcoming-session reminders and support for multiple future closed sessions.
6. AWS deployment via EventBridge (or similar), API Gateway, and possibly Lambda.
7. Live testing and integration with the real server.

## Private-server setup

- [Private test-server and bot setup](private-discord-test-setup.md)
