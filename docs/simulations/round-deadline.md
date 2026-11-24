# Round deadline simulation

This scenario validates the first workflow slice without Discord. It creates an
open round, records three hypothetical members' multi-select availability, then
processes the round deadline one millisecond after it closes.

## Setup

Start MongoDB using either native MongoDB Community Server or Docker Compose,
copy `.env.example` to `.env` if needed, then initialize indexes:

```powershell
npm run db:init
```

## Run the successful-selection scenario

```powershell
npm run simulate
```

The simulator clears only its own previous `simulation-guild` records before
creating the scenario, so repeated runs are deterministic. To clear those
records without running a new scenario, use:

```powershell
npm run db:clear-simulations
```

Expected result:

- The output contains one decision with `kind: "selected"`.
- The `2026-12-04` slot has three votes; `2026-12-05` has one.
- `completedRound.selectedSlot` is `2026-12-04`.
- `completedRound.deadlineProcessedAt` has a timestamp.
- The overall `completedRound.status` remains `"open"`, because activity and
  host collection can still happen.

## Inspect the stored data

```powershell
mongosh "mongodb://127.0.0.1:27017/board-game-scheduler"
```

Then run:

```javascript
db.planningRounds.find().sort({ createdAt: -1 }).limit(1).pretty()
```

## Process real expired rounds manually

Once a round's deadline is in the past, this command processes it:

```powershell
npm run schedule:process
```

It is safe to run repeatedly: a processed round has `deadlineProcessedAt` set
or has left the `open` status, so it is not processed again.
