# Independent review: PR #673 (the Hidden Boss's room challenge), read-only

Effort xhigh: server, an online match start, admin-only server actions. Read CLAUDE.md, then
`git diff origin/main...origin/claude/hidden-boss-challenge` and the PR body (`gh`-less: the PR is ericmueller21k-gif/chessroyale#673).
Look for:
- the room of four (`packages/server/src/hidden-room.ts`, `hidden-room-api.ts`):
  - a 5th getting in;
  - two requests at once, or one person in two requests;
  - a double start (two taps, two tabs, a retry);
  - a seat lost or doubled at the hand-off (`hiddenFight` → `joinLobby`);
  - the cap, leave, cancel or disconnect racing the start;
  - a stale person who never leaves;
- admin gates: "Fill with 3 bots" and `{ t: "winForm" }` (`LobbyCore.winFormTrigger`) reachable by a player, or outside his room's fight;
  `bossForceWin` / `winForm` leaking into any other lobby, or XP/coins/ranked from a forced win;
- `partyMove`'s tie change: anything that changes an existing mode's results (Crowd, other party battles, the replay of a stored game);
- the protocol change staying optional (old clients, other lobbies);
- the app: leaving asks on every exit, nothing hidden (greyed instead), no stuck screen if the fight never starts.
Run the server and core unit tests (`npx vitest run packages/server packages/core`). No e2e runs.
Write `review.md` on orphan branch `review/hidden-challenge`: findings blocker / major / minor with file:line and a failing case, or
"no findings"; push it and stop. About 30 minutes.
