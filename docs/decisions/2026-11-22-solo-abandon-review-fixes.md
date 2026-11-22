# Solo abandon: the review's fixes (Nov 22, 2026)

Review of PR #881 ([solo-abandon](2026-11-22-solo-abandon.md)): a finished game could still be recorded as left. Calls:
- A result is kept on the device before its post, dropped only on a 2xx or a 4xx other than 429, and sent again (`resent`) at the next
  start, load or sign-in. Reads and starts name its game (`unsent`), so none records it as left, stale or not.
- A re-sent result earns no time XP, so no win or daily reward either (the server's clock ran on). The game still counts.
- A guest joining an account has its real game recorded as left first; the sign-in sends a kept result before it.
