## The Hidden Boss never plays a weak move because something lagged: his phase 2 moves come from the engine server alone

**Lane: full** (server, the online match, protocol, stored results, fair play). Please add the **`full-e2e`** label; an independent
review follows.

Eric, Nov 13: "we can't have him breaking ... if the engine doesn't load properly ... I almost feel like we need to pause the game. Or
I guess it falls back to the server ... I will be providing some funds for our server when the game goes, so we can always utilize
that." Until now (#677), a move of his the engine server couldn't answer went to the host's device, then to the server's quick move:
the team's own host could compute its opponent's moves, and a lag gave a weak move.

### What changed (players see)
- **His four boards online never get a weak or device-made move from him.** His moves come only from the engine server.
- **His move late (3 s): the fight pauses.** Every board shows "He's thinking…", every clock stops where it stood, and no board takes
  a move. When his move comes in, the clocks run on from where they stood.
- **His move never in (60 s): "No result: the Hidden Boss couldn't connect."** The fight ends there. The results say "Nothing counts
  for or against anyone": no XP, no rank, no win or loss on your profile. His figure and yours just stand, as after a draw.
- He (and a bot) always takes a mate in one.

### How
- `packages/server/src/bosses/recluse.ts`: his moves are asked of the engine server only (`searchHis`, his searches marked `boss`).
  An empty answer is tried again after `retryMs` (1 s), doubling to `retryMaxMs` (8 s); a search lost on the way is tried again after
  20 s. Any try's answer plays. Late past `pauseMs`, `hold` pauses every clock (`recluse2.paused`, told to everyone): people's moves are
  refused, his and the bots' wait, nothing flags or times out, the admins' ultimate waits. When his move is in, every turn's start and
  each bot's thinking move on by the pause. Past `serverWaitMs`, `noResult` ends the fight (`done.noResult`) and drops phase 2's
  fair-play moves (`fairFrom`).
- `phase2Ask` is a bot's only now (a bot plays for its own team). A bot's move still comes from the engine server, then the host's
  device, then the quick move.
- **No engine server set up at all** (local runs, the e2e suite, staging): his move is the server's quick move, and phase 2's result
  is unvouched (it pays as a solo game and isn't ranked). Production always has the server. The Durable Object passes `phase2Search`
  only where the server is set up.
- **His own share of the engine server's day:** his searches count on the row `<day>:recluse` up to `RECLUSE_ONLINE.dailySearches`
  (3000), apart from the judges' re-checks and solo's (pool `"recluse"` in `engine.ts`). Once his share is spent, the day's budget.
  **Cost (Eric's money):** each of his searches is about a third of a re-check's nodes, so the full share is under about $0.30 a day
  (under $9 a month), spent only by fights (about 150 searches a long fight). Eric's "I will be providing some funds" covers it; the
  number is his to change.
- **Mate in one:** the engine server never sends `mate`, so `pick()`'s mate rule never fired online. `withMates` marks every mate in
  one by the rules (`gameEnd(fen, [move]) === "checkmate"`).
- **No result in the lobby:** `humanResults` marks each result `noResult` (not ranked). `writeResult` writes its fair play (phase 1's
  moves) and stops: no XP, no result row, no Welcome Crate, no token. The results message has `noResult` and `bossResult: "draw"`.
- **The app:** `recluse-online.ts` takes no move while paused and holds the look-aways during a pause (your clock isn't running).
  `Recluse2.tsx`: "He's thinking…" over every board still on, clocks shown where they stood, the dock's clock held, and the
  no-result words. `Results.tsx`: the no-result line.
- **Settings:** `RECLUSE_ONLINE.pauseMs` 3000, `retryMs` 1000, `retryMaxMs` 8000, `serverWaitMs` 60000, `dailySearches` 3000.
  `askMs` is the bots' only now.
- **Protocol:** `NetPhase2.paused?` and `done.noResult?`, and the results' `noResult?`. All optional.

### Phase 1's boss moves in his fights (the brief: "say what they do"), unchanged here
His adult form online (and the child form, once wired online) plays as every boss does. The host's device makes his move (Maia, his
fixed brain; Stockfish's seeded move where its Maia isn't loaded), and a second device checks it with the same seed (`BOSS_CHECK`).
If the two answers differ, the engine server keeps the better one for him. With no second device, the host's move stands alone and
the match pays as a solo game. With no answer in 15 s, another device is asked. If no device answers at all, he plays **a random legal
move** (`bossTimeout`). His thinking never costs the crowd clock time, so a lag costs nobody time. Only a total failure gives a weak
move.

Moving phase 1 to the server too needs a design call for Eric and the director: the engine server runs Stockfish only, so it would
mean Maia on the server, or Stockfish for his adult form online.

### Calls made
In `docs/decisions/2026-11-13-recluse-server-only.md`:
- **The pause waits 3 s:** an answer normally takes about a second.
- **A pause freezes the whole fight.**
- **"No result" covers the whole match for everyone,** a Crowd final's watchers too.
- **Fair play keeps phase 1's moves;** phase 2's are dropped.
- **His share is 3000 a day,** with its cost.
- **With no engine server set up at all, his move is the quick move,** and phase 2's result is unvouched.
- **Phase 1 is left on devices.**

### Checks changed (old → new)
- `packages/server/test/recluse-online.test.ts`:
  - "no engine server: the host's device plays his moves and the bots' …" → "no engine server set up (local runs, the e2e suite): a
    bot's move from the host's device …; his, the server's quick move at once (phase 2's result unvouched), never a device's".
  - "every board won …", its "lost on time" half: an engine server that answers (`auto`) and a 2 s bank. Before: no answers and the
    2:00 bank. With his moves in, the bots' slow moves bring his ultimate first, and no flag falls under it.
  - "a disconnect …": an engine server that answers (`auto`). Before: one that never answered, which now ends the fight first.
  - M1, "a host that never answers: his move is the server's quick move …": **removed**, since no device plays his moves now. The new
    tests below cover what happens instead.
  - M1, "the host drops with his move asked of it" and "an honest host's reload": the same checks, now on a bot's move.
  - M2, "his move on the host's device: phase 2's result unvouched …" → "his quick move with no engine server set up: …" (the same
    checks).
  - New: "his moves from the engine server only":
    - retries, never a device, and a bot's move still goes to a device;
    - a slow answer pauses and resumes every clock;
    - no answer ends with no result, and only phase 1's fair play is written;
    - a late fair-play answer after that is dropped.
  - New: "a mate in one".
- `packages/server/test/engine-server.test.ts`: new, his own share of the day (the judges' spent budget doesn't stop him; his share
  spent, the day's).
- `packages/app/test/recluse-online.test.ts`: new, the pause (no move, clocks held, look-aways held) and no result.
- `e2e/hidden-boss-room.spec.ts` (a guard test in `docs/rules/eric.md`): **its comment only**, no check changed. In the suite, the
  server's quick move plays him because there's no engine server.

### Tests run
- `npm run typecheck` (core, chess, server, app): clean.
- Unit:
  - every server test file (87 files);
  - the app's and core's (204 files, 2776 tests);
  - again after merging main (#678, the child form): the phase 2, Crowd final and engine-server files.
- e2e: `e2e/hidden-boss-room.spec.ts`, phone: both tests pass (the room and the 🏆 through the four boards to "4 of 4"; the 5th at
  his door). Run with the container's own Chromium (the pinned Playwright's browser isn't installed here).
- No still: a pause can't happen in a local run (no engine server there). The "He's thinking…" words reuse the board's result tag.

### Not done
- Phase 1 stays on devices (above).
- The health view shows the day's budget, not his row (`<day>:recluse`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01JuCWRveEsunqzmBPmMiQy1
