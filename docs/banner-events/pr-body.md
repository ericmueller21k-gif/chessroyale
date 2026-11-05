# Queen banners only from real captures, each shown once; Alfil's Slam test plays until the Slam lands

## What changed

Eric, Nov 5: the queen banner should fire "literally when a capture is written", tied to the capture, not worked out from
the board. Before this, QUEEN DOWN! and QUEEN SLAIN! were recomputed on every redraw from board state, so every screen
that redrew without a new move (the Slam, a bounce, the funhouse, a second thinking) needed its own guard.

- **The engine records captures.** `playOnBoard` (every boss-battle move goes through it: yours, the boss's, Hollow's
  extra move, the move Boingo's funhouse plays for you) appends `{ ply, side, from, to, piece, color }` to
  `BoardState.captures` (`captureOf` in `packages/chess/src/rules.ts`, en passant included). It's kept in the stored
  match (the snapshot) and sent as `NetBoard.captures`, an **optional** field. Folio's Revision removes the records of
  the moves it crosses out. Powers (burn, bounce, freeze, Slam, plant, etc.) write none.
- **The banners read only those records.** New `packages/app/src/battle-banners.ts` turns them into events:
  - QUEEN DOWN! for each boss move that took your queen, on the screen where that move lands.
  - QUEEN SLAIN! for each of your moves that took his queen, in his thinking right after.
  - Each is keyed to its ply, due only while its move is the newest on the board, and shown once (`bannerOn`, reset at a
    battle's intro).
- **Guards removed from `Boss.tsx`:** `!funhouse && !bounce`, the "his move is the board's last" comparison, and the
  `queenSlain` board look-up.
- **`queenSlain` and `lastMove.captured` read the same record.** `queenSlain` is how long he thinks; its Revision check
  went, and its bounce/hop/step checks stay because they set the clock for his second thinking.
- **Power banners unchanged.** They were already tied to each use: keyed `boss:kind:turn` and drawn only inside their
  moment. The new tests check each one shows once per use.
- **Every mode** (Boss alone, raids, the Crowd's boss final; solo and online) goes through `playOnBoard` and `BossScreen`.
- `e2e/areas.json`: `battle-banners.ts` added to the boss screen's area. Area page `docs/areas/bosses.md`; decision note
  `docs/decisions/2026-11-05-banner-events.md`.

**Old matches and apps.** A match stored before this has no records for its earlier captures. Those banners have already
played, and every capture after the update is recorded. An older app ignores `captures`. A new app talking to an old
server shows no queen banners; the Worker serves both, so that only happens during a deploy.

## Player-visible changes

No new text.
- A queen banner never comes back: not on the Slam's turn, a bounce, the funhouse or a second thinking.
- A banner fires only for a real capture. A power that removes or moves a queen without capturing it never shows one.
  A real capture made with a special move, such as Wrangler's long pull, now shows its banner (before, the move-string
  comparison missed it).
- Once a queen banner's time is up it's taken off the page; before, it stayed mounted after its slide-off.
- An en-passant capture now counts as a capture in the boss's last move, so his "capture" beat plays for it.

## Changed checks (old → new)

- `e2e/alfil.spec.ts`, "Alfil's Mammoth Slam right after a queen is taken": played at most 14 of your moves and could run
  out before the Slam (it failed that way on CI) → plays until the Slam has landed, with a 7-minute cap. It stops early
  if the battle ends. Same assertions.
- `packages/chess/test/boss-guard.test.ts`, the 3 "queen captures in the boss battle" tests: the view was a bare move
  history → the board is played through `playOnBoard`, which writes the records. Same assertions.
- `packages/chess/test/alfil.test.ts`, "…QUEEN SLAIN! never again after one of his steps", and
  `packages/chess/test/hopper.test.ts`, "QUEEN SLAIN! never again in his thinking after the hop": the hand-built board
  gains its capture record. Same assertions.
- `packages/app/test/banners.test.ts`, "START!, the queen banners, PHASE 2 and 5 SECONDS!…": the `took` board gains its
  capture record. Same assertions.
- New: `packages/app/test/battle-banners.test.ts` (41 tests):
  - each capture is recorded;
  - one banner per queen capture, on its own screen;
  - a trade gives both banners, each once and in its own turn;
  - Slam, bounce, step, funhouse and second-thinking screens don't repeat a banner;
  - Folio's Revision (its real hooks) leaves no record and no banner;
  - a power that changes the board around a queen gives no banner, and a real capture right after one gives exactly one;
  - each power banner shows once per use, keyed to that use.

None of these guards a rule in `docs/rules/eric.md`.

## Lane

**Full e2e** (add the `full-e2e` label): this changes shared rules (`rules.ts`, `boards.ts`, `runner.ts`,
`boss-timing.ts`), adds an optional protocol field, and edits `e2e/areas.json`. It's boss content otherwise, so it also
gets the boss lane's quick review.

Local checks:
- `npm run typecheck` passes.
- `vitest` on chess, app, server and core: 4066 passed. One failure, `duel.test.ts` "the result card…", is a 5 s
  timeout that fails the same way on main's code.
- e2e: see the report.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
