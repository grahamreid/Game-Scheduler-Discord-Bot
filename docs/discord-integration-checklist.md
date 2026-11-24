# Private Discord integration checklist

Use this checklist for the first real Discord test-server slice. It deliberately
keeps the scope to availability; activity suggestions follow after this works.

- [x] Add an administrator command to configure weekly or biweekly scheduling,
  its first survey date, and default weekend splitting. `/round create` uses
  those defaults and can override its 7- or 14-day range and weekend splitting
  for a single manual round.
- [ ] Add channel configuration and select-menu-limit validation before regular
  round creation.

Do not add the bot to the real server or share its token while this checklist is
in progress.
