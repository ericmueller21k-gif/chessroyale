## The Hidden Boss online plays through to the end: his phase change and the four boards

**Lane: full** (server, protocol, the online match, fair play). Please add the **`full-e2e`** label; an independent review follows.

Eric, Nov 13: "it plays through to the four boards... It plays through till the end." Until now, online, beating his adult form ended
the fight as a win; his phase change and the four boards were solo only.

### What changed (players see)
- **His room's fight and the Crowd's boss final, online:** beating his adult form brings his fall, then his phase change, the same
  moment on every screen, then the four boards to the real result. "You beat the Hidden Boss on all 4 boards!", or he wins and the
  results say how many were won.
- **Leaving** (resign, or gone longer than the away limit): a bot plays your board on, and it counts as a loss for you. The leave
  confirm says so.
- **The admin's 🏆** works in the four boards too: the team's next move (a person's or a bot's, any board) wins every board still on.
  The admin's ultimate trigger brings his "5 SECONDS!" there.
- **A Crowd final's watchers** see the four boards; none is theirs.
- The FAQ: "Beaten: his second phase follows, online and in a Solo game…".

### How (the server runs it)
- `packages/server/src/bosses/recluse.ts` (new): the online phase 2 on the same pure rules as solo (`recluse-phase2.ts`). It runs the
  boards, the clocks, the flags, his ultimate's random moves, the bots' thinking, the results, the 🏆, and handing a board to a bot.
  The lobby's new phase is `phase2` and its record `recluse2`. Hooks in `lobby.ts`: his defeat, the timer, messages, leaving and the
  away sweep, the results (`simul`), the 🏆 and the ultimate trigger.
- **His moves and the bots' come from the engine server.** Every legal move is scored, in groups of at most 8 (`serverAllMovesAt` in
  `engine.ts`; the container only has its 8-move search, and its image is pinned). He plays the best; a bot plays one within `botLoss`.
  Each position counts as one search against the day's budget. Where the server can't answer, the host's device plays the move
  (`phase2Ask`/`phase2Answer`), and the match then pays as a solo game. With no answer in `askMs`, the server plays its own quick move.
- **Fair play:** each person's move is scored on the engine server and kept as a `FairMove` with no crowd.
- **The cutscene's hold:** `RECLUSE_CUTSCENE.holdMs` (0 for now). After his fall the server sends `recluseCutscene` (its start and
  end), then his phase change starts at `phase2`'s `at` for everyone. The cutscene job reads `NetMatch.phase2.cutscene`.
- **His forms are a list:** `RECLUSE_FORMS = ["adult", "four"]` with `recluseNextForm`. The child form goes first without touching
  this code.
- **The app:** `recluse-online.ts` (new, `OnlinePhase2`) puts your board first, works in this device's times, switches the phase at the
  server's moments, plays his lines and sounds as solo's, and shows your move at once. `NetMatch` adds `simul`, `simulMove`,
  `bossNote`, `phase2Ahead` (his themes fetched ahead) and the 🏆 in phase 2. The screens are solo's. The phase 2 message carries the
  battle and the standings, so a reload in the middle has them.
- **Settings:** `RECLUSE_FORMS`, `RECLUSE_CUTSCENE.holdMs`, and `RECLUSE_ONLINE` (`changeMs` 34.3 s: the screens' `PHASE_CHANGE.total`,
  kept within 300 ms by a test; `groupNodes`, `botLoss`, `askMs`). The fall moved to `RECLUSE_PHASE2.change.fallMs`.
- **Decision:** `docs/decisions/2026-11-13-recluse-online-phase2.md` (9 calls, including the engine-server approach, the budget, the
  🏆 as the whole phase, leaving, fair play and the 50 v 50 final). Area pages: `bosses.md` ("Phase 2 online"), `crowd.md`,
  `town-square.md`.

### The 50 v 50 final
It reaches him online through the same path (`phase2Online`: his room's fight, or a Crowd final). The top 4 who fought him take the
boards, with fresh bots for any board left empty; everyone else watches.

### Tests
- New `packages/server/test/recluse-online.test.ts` (12): the forms list; the fall, then the cutscene event and phase 2 with the same
  times for everyone; no move before the clocks; a person's move (only theirs, legal, refused → told again); his best and a bot's within
  `botLoss` after its thinking; with no engine server, the host's device and then the quick move; every board won → 4 of 4; a board
  lost on time → his, 3 of 4; the 🏆 in the adult form, then the four boards; the ultimate trigger; a resign (a bot plays the board,
  the leaver's loss); a disconnect past the away limit, then everyone gone (his).
- New `packages/app/test/recluse-online.test.ts` (5): `changeMs` against `PHASE_CHANGE.total`; the view (your board first, local
  times); the phase at the server's moments; your move sent and shown; a watcher has no board.
- e2e `e2e/hidden-boss-room.spec.ts`: admin + 3 bots → 🏆 adult → his phase change → four boards (the bots move, from this device's
  engine as the server asks) → 🏆 → a real move by taps → "on all 4 boards!", on both projects. Local run: 4/4 passed (phone 2.1 min,
  computer 2.0 min). Stills: `docs/recluse-online-phase2/` (phase change, four boards, result; phone and computer).
- Typecheck green. Unit tests: server + core 1520/1520, app 2452/2452.

### Checks changed (old → new)
- `packages/server/test/crowd-hidden-boss.test.ts`, "beaten online: … then the results, the crowd's victory: no phase 2 online" →
  "his fall (`toPhase2`, phase 2's length), then his phase 2 for the top 4; nobody moves, every board lost on time, he wins, 0 of 4".
- `e2e/hidden-boss-room.spec.ts`, the room's fight: "🏆 → the results, the crowd's" → "🏆 → his phase change → the four boards → 🏆
  → a move → the results, 4 of 4".
- `packages/app/test/faq.test.ts`: "online, that's the crowd's victory" → "his second phase follows, online and in a Solo game".
- None guards a rule in `docs/rules/eric.md`.
- `e2e/crowd-hidden.spec.ts` (online) isn't edited. If the crowd beats him there, its play-to-the-results loop now runs through phase 2
  (about 3 more minutes, within its 8). CI's full run will show it.

### For the director / Eric
- **Budget:** a long fight might take about 300 of the engine server's 3000 searches a day. Nothing was raised. A share of its own
  (like solo's) is Eric's call if these fights become common.
- **His strength online:** full Stockfish at 120k nodes per group of moves, not UCI_Elo 2750 (the container has no Elo-limited
  search). He is probably a little stronger than solo's. `groupNodes` is the number to tune.
- **Not done:** XP's move count online is phase 1's picks only. A reload in the middle of his room's fight doesn't know it's the
  room's (no 🏆 after it), as before this PR.
- **For the parallel jobs:** `RECLUSE_CUTSCENE` will conflict with the cutscene branch's own `RECLUSE_CUTSCENE` in settings.ts (one
  hunk: add `holdMs` to theirs). The child form adds `"child"` first in `RECLUSE_FORMS`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01JuCWRsbJBuVni54xhGTj6A
