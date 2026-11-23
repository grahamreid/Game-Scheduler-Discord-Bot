# Board Game Scheduler architecture

## Purpose

The bot runs recurring board-game-night planning rounds for a Discord guild. A
round gathers availability, presents activity ideas for discussion, finds an
eligible volunteer host, and posts a final result.

## Boundaries

```text
Discord interactions / local simulator
                 |
                 v
       application services (use cases)
                 |
                 v
       domain rules and selection logic
                 |
                 v
          repository interfaces
                 |
                 v
        SQLite and scheduling adapters
```

Discord-specific code only translates commands, components, and modals to
application-service calls. Business rules must be usable by the local simulator
without Discord.

## Round workflow

1. An administrator creates an `open` round with its possible event dates and
   an availability deadline.
2. The availability prompt is open until the deadline; members can select all
   dates that work for them.
3. A scheduler closes availability at the deadline and selects the most popular
   date. A tie is resolved by a follow-up, single-choice Discord poll.
4. Members can add activity suggestions and see/rate activity ideas. These are
   discussion material, not a binding winner calculation.
5. Eligible members volunteer to host: they must have selected the chosen date.
   The least-recent prior host is selected.
6. The bot publishes the date, activity ideas, and host.

Activity and host collection may run at the same time as availability, but host
eligibility is evaluated only after the event date is chosen. The first release
will use an availability deadline; activities do not need an independent close
time unless a future workflow needs one. The status values are intentionally
small: `open`, `availability_tiebreak`, `finalized`, and `cancelled`.

## Time model

Store an instant for anything that is a deadline, event, or audit record:

- `availability_closes_at`: required instant used by the scheduler.
- `created_at`, `updated_at`, submitted/voted/volunteered timestamps, and
  announcement timestamps: useful audit data.
- `selected_date` and candidate dates: calendar dates (`YYYY-MM-DD`) in the
  guild's configured time zone, not instants.

SQLite has no native timestamp storage class. It commonly stores instants as
UTC ISO-8601 `TEXT` values (for example `2026-11-23T05:00:00.000Z`) or epoch
milliseconds as `INTEGER`. We will use UTC ISO-8601 text for readability and
reliable lexical sorting, with application validation. This is a SQLite storage
choice, not an absence of timestamps.

## Initial persistent model

```text
guilds
  id, default_channel_id, timezone, created_at

planning_rounds
  id, guild_id, channel_id, status, title,
  availability_closes_at,
  selected_date, selected_host_user_id,
  finalized_at, created_at, updated_at

round_candidate_dates
  id, round_id, candidate_date, display_order

availability_responses
  round_id, user_id, candidate_date_id, submitted_at

activities
  id, guild_id, display_name, created_by_user_id,
  first_suggested_at, last_suggested_at, selected_count

activity_votes
  round_id, user_id, activity_id, voted_at

activity_proposals
  round_id, user_id, activity_id, proposed_at

hosting_volunteers
  round_id, user_id, volunteered_at

hosting_history
  id, guild_id, round_id, user_id, hosted_on, recorded_at

round_announcements
  id, round_id, kind, discord_message_id, posted_at
```

`round_candidate_dates` is intentionally retained. It is the authoritative
ballot definition: it permits showing options before responses exist, retaining
zero-vote dates, enforcing that a response belongs to this round's choices, and
rendering/re-running a tie poll consistently. Responses alone cannot represent
a candidate chosen by no one.

There is no `round_members` table in the initial design: Discord supplies
member identity as needed. There is also no `round_activity_options` table.
The activity UI will derive its list from recent/popular activities plus
activities proposed for the current round. Duplicate activity names are allowed
for now; future moderation can delete or hide unwanted entries.

`display_name_snapshot` is deliberately omitted. It would mean the user-facing
name as it appeared when a person responded, useful because Discord names can
change. We do not need it initially; user IDs remain the stable identity and
Discord can resolve current display names when rendering.

## Local verification

The application will include a CLI simulation adapter that calls the same
services used by Discord. Fixture users and a controllable clock let tests
submit several users' answers, advance past the availability deadline, and
verify selections without multiple Discord accounts. A private Discord test
guild will cover real interaction components.

## Moving beyond SQLite

The application layer depends on interfaces such as `PlanningRoundRepository`,
not the SQLite driver. When changing databases, the domain types, Discord
handlers, selection rules, and simulator scenarios stay the same. We would:

1. Write a new adapter, for example `PostgresPlanningRoundRepository` or
   `DynamoPlanningRoundRepository`, that implements the same interface.
2. Add that database's connection setup and replace the application's wiring
   at startup.
3. Rewrite the physical migrations/schema for the selected engine and migrate
   the data. SQLite SQL is not automatically portable: PostgreSQL has native
   `timestamptz`/`date` types, while DynamoDB needs a deliberate key and index
   design instead of relational tables.

Drizzle provides useful TypeScript query types for SQLite and PostgreSQL. It
does not make a relational schema automatically interchangeable with DynamoDB;
the repository boundary is what keeps that change isolated.
