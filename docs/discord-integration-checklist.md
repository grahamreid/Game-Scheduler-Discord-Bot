# Private Discord integration checklist

Use this checklist for the first real Discord test-server slice. It deliberately
keeps the scope to availability; activity suggestions follow after this works.

- [ ] Implement an administrator-only `/round create` command that creates a
  planning round.
- [ ] Post a shared availability message with a multi-select menu; persist each
  member's one-time response through the existing availability workflow.
- [ ] Add `/round status` for manually inspecting the current round and
  response count during private-server testing.

Do not add the bot to the real server or share its token while this checklist is
in progress.
