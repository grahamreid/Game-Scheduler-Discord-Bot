# Private Discord integration checklist

Use this checklist for the first real Discord test-server slice. It deliberately
keeps the scope to availability; activity suggestions follow after this works.

- [ ] Test a shared availability message with a multi-select menu; verify each
  member's one-time response persists through the existing workflow.
- [ ] Add `/round status` for manually inspecting the current round and
  response count during private-server testing.
- [ ] Add an administrator setup command that validates/stores Discord channel
  configuration and the select-menu slot limits before regular round creation.

Do not add the bot to the real server or share its token while this checklist is
in progress.
