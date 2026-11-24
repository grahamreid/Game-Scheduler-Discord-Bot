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
  member may re-submit the shared menu before the deadline; their latest
  response replaces their earlier one.
- Creating a newer planning round automatically cancels any earlier active
  round in the same guild.
- The most popular slot wins. A tie selects the alphabetically earlier slot.
- Activity suggestions are non-binding discussion input; do not automatically
  select an activity winner.
- Members may vote for up to three activities and propose one free-text
  activity. Newly proposed activities become visible immediately.
- Show the five most popular recent activities, plus current-round suggestions.
- Activity duplicate detection is deferred. Provide an administrative cleanup
  command later.
- A selected host must volunteer and be available on the selected date. Among
  eligible volunteers, choose the least-recent host.
- `/round wipe` is administrator-only, confirms through a private Discord
  button, and deletes only the current guild's rounds and availability data.
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

1. Activity suggestions and voting display.
2. Host volunteering and host-history selection.
3. Complete final round closure and announcement, including activity discussion
   results and selected host.
4. Automated recurring round creation from guild scheduling settings.
5. Upcoming-session reminders and support for multiple future closed sessions.
6. AWS deployment via EventBridge (or similar), API Gateway, and possibly Lambda.
7. Live testing and integration with the real server.

## Private-server setup

- [Private test-server and bot setup](private-discord-test-setup.md)
