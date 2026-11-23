# Decisions and backlog

## Confirmed decisions

- SQLite is the initial local-development database.
- TypeScript and discord.js are the implementation platform.
- Availability is a multi-select question and has a scheduled close deadline.
- The most popular available date wins. An availability tie receives a separate
  single-choice tie-breaker poll.
- Activity suggestions are non-binding discussion input; do not automatically
  select an activity winner.
- Members may vote for up to three activities and propose one free-text
  activity. Newly proposed activities become visible immediately.
- Show the five most popular recent activities, plus current-round suggestions.
- Activity duplicate detection is deferred. Provide an administrative cleanup
  command later.
- A selected host must both volunteer and be available on the selected date.
  Among eligible volunteers, choose the least-recent host.
- If a chosen date has only two available members, cancel the round (exact
  cancellation behavior to be defined during workflow implementation).

## Deferred Discord commands/features

These are intentionally not part of the first implementation slices.

| Idea | Notes |
| --- | --- |
| `/activity delete` | Administrative removal/hiding of unwanted or duplicate activity suggestions. |
| Tie-break poll | A single-choice prompt used only when availability has a tie. |
| Reminder messages | Consider prompting members before a deadline. |
| Round cancellation messaging | Needed when turnout is below the minimum. |
| Recurrence administration | Configure cadence, channel, candidate-date generation, and deadlines. |
| Deployment plan | Evaluate AWS hosting after local workflow is proven. |

## Implementation sequence

1. Database schema, migrations, local setup, and simulator.
2. Round lifecycle, deadline processor, and availability winner/tie logic.
3. Discord announcement and availability collection.
4. Activity suggestions and voting display.
5. Host volunteering and host-history selection.
6. Final announcement.
7. Automated recurring round creation.
