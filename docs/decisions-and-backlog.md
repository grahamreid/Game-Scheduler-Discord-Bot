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
- If a chosen date has only two available members, cancel the round (exact
  cancellation behavior will be defined with workflow implementation).
- `/round wipe` is administrator-only, confirms through a private Discord
  button, and deletes only the current guild's rounds and availability data.
- Guild scheduling settings support `weekly` and `biweekly` cadence, a first
  automated-survey date/time, a default availability deadline, and an optional
  weekend Afternoon/Evening split. They also define the minimum number of
  available attendees required for a slot to win. Manual round creation starts
  immediately.

## Deferred Discord commands/features

| Idea | Notes |
| --- | --- |
| `/activity delete` | Administrative removal/hiding of unwanted or duplicate suggestions. |
| Reminder messages | Consider prompting members before a deadline. |
| Round cancellation messaging | Needed when turnout is below the minimum. |
| Recurrence administration | Configure cadence, channel, slots, and deadlines. |
| Monthly cadence | Requires an explicit calendar rule (for example, same day-of-month or nth weekday), behavior for months without that date, and a guild timezone. It cannot safely reuse the fixed 7/14-day calculation. |
| More timezone mappings | Initial setup maps ET/EST/EDT, CT/CST/CDT, MT/MST/MDT, and PT/PST/PDT to IANA zones. Add other regions or direct IANA-zone selection as needed. |
| AWS deployment | Lambda/API Gateway/EventBridge after local workflow is proven. |

## Implementation sequence

1. Discord announcement / integration, and private-server testing.
2. Activity suggestions and voting display.
3. Host volunteering and host-history selection.
4. Final announcement.
5. Automated recurring round creation.
6. AWS deployment via EventBridge (or similar), API Gateway, and possibly Lambda.
7. Live testing and integration with the real server.

## Private-server setup

- [Discord integration checklist](discord-integration-checklist.md)
- [Private test-server and bot setup](private-discord-test-setup.md)
