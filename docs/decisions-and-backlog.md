# Decisions and backlog

## Confirmed decisions

- TypeScript and discord.js are the implementation platform.
- MongoDB is used directly for both local development and the initial cloud
  deployment. MongoDB Atlas M0 is the intended MVP database.
- Local MongoDB runs through Docker Compose.
- The code intentionally has no generic database abstraction/repository layer.
- Availability is multi-select and has a scheduled close deadline.
- The most popular date wins. An availability tie receives a separate
  single-choice tie-breaker poll.
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

## Deferred Discord commands/features

| Idea | Notes |
| --- | --- |
| `/activity delete` | Administrative removal/hiding of unwanted or duplicate suggestions. |
| Tie-break poll | A single-choice prompt used only for an availability tie. |
| Reminder messages | Consider prompting members before a deadline. |
| Round cancellation messaging | Needed when turnout is below the minimum. |
| Recurrence administration | Configure cadence, channel, dates, and deadlines. |
| AWS deployment | Lambda/API Gateway/EventBridge after local workflow is proven. |

## Implementation sequence

1. MongoDB setup, local Docker development, and simulator.
2. Round lifecycle, deadline processor, availability winner/tie logic.
3. Discord announcement and availability collection.
4. Activity suggestions and voting display.
5. Host volunteering and host-history selection.
6. Final announcement.
7. Automated recurring round creation.
