# Review: `claude/dash-hang-on` (Dash's Time Scramble by use, and "Hang on")

Boss lane, one quick read-only pass (CLAUDE.md, "Test lanes"). Reviewed head `7d9722ad` (`48a2503` after it only drops `.pr-body.md`
and `.done`). Read: the PR body, `docs/decisions/2026-11-26-dash-hang-on.md`, and `git diff origin/main...origin/claude/dash-hang-on`,
plus the code it calls (`prepareTurn`/`unleashed` in `boss-powers.ts`, `warnThenUnleash`, the lobby's `thinkMinAt`/`playBoss`/
`requestExtra`, solo's `bossTurn`/`extraTurn`, `OwnBoard`'s premoves, `MovePanel`). No tests run (read-only).

**Verdict: no blockers, no should-fixes. Three nits, all display-only.**

## Findings

### 1. Nit: pre-moves that are already queued are drawn over the slid-back board, so the moved piece jumps around

`packages/app/src/screens/Boss.tsx:474` (`hangOn?.fen` becomes the board's `fen`) with `packages/app/src/board/OwnBoard.tsx:202`
(`shown = premovePieces(base, queue)`) and `packages/app/src/board/logic.ts:587-588` (a premove whose from-square is empty is skipped).

Failing case: you queue two premoves, Ng1-f3 then Nf3-g5. Ng1-f3 plays on your turn, and Nf3-g5 waits through his thinking, which is the
Hang on turn.
- Before `backAt`, the knight is drawn on g5 (the queue applied to the real board).
- At `backAt`, the board's fen becomes the position before Nf3. f3 is now empty, so the queued Nf3-g5 is skipped. The knight slides
  **g5 → g1**, not f3 → g1, and the premove's red squares stay on f3 and g5 while the knight sits on g1.
- At `returnAt`, the knight slides **g1 → g5** in one jump.

A related case: a queued premove *onto* the square your piece left (Ng1-f3 played, then Rh1-g1 waiting) draws the rook over the
slid-back knight on g1, so the knight vanishes for the gag.

Nothing gets stuck, and the queue, the game and the premove that plays later are all correct. This is only what the board shows. A
possible fix: while `hangOn` is set, draw the board without the queue's pieces (keep only the marks), or skip the slide-back when a queued
premove starts on your move's to-square.

### 2. Nit: `popOffHolding` didn't get the new "after your move" check, so the move list still hides a row during a failed Rush's extra-move thinking

`packages/chess/src/bosses/dash.ts:259-260` (`popOffHolding`: `popOff.at >= powers.turn - 1`, no `crowdMoves` check), read at
`packages/app/src/components/MovePanel.tsx:89`.

Failing case: the pop-off or Hang on turn T is also the turn his Scramble Rush comes, and the Rush fails. As turn T begins, the list's last
row is his move of turn T-1. While he thinks for his extra move (`thinking: true`, `popOff.at === powers.turn`, `crowdMoves === T-1`),
`popOffHolding` is true and the last row is a boss row, so **his previous move disappears from the list** until the extra move lands.
`popOffPending` now correctly says no for this thinking (the PR's point 3), but the list's hold still says yes. This was already
true before the PR, and it's only a display issue. A possible fix: also require `crowdMoves === powers.turn` in `popOffHolding` when
`popOff.at === powers.turn`. The `at === turn - 1` branch (his move just played) needs no change.

### 3. Nit: if a device first sees the gag late, the gag starts from 0 there while the server's hold keeps its own start

`packages/app/src/components/Dash.tsx:187-192` (`popOffSeen`: the gag runs from when this device first saw it) and
`packages/server/src/lobby.ts:2458` (`thinkMinAt`: the hold counts from when the thinking began on the server).

Failing case: online, a phone reloads or rejoins 10 s into the 12.9 s hold. It starts the gag at 0, and about 2.9 s later his move
arrives. `thinking` goes false, so `gagAt` and `hangOnFen` turn off. The board then animates from the slid-back position straight to the
real one with his move, and the clock shows the real value again. Nothing is left stuck: the board, the clock and the premove `watch` all
read `thinking`. The decision note already says the gag "plays from when a device first sees it", and the pop-off works the same way. The
gap is just more noticeable over 12.6 s than over 4.6 s. If it matters, Birdie's way would fix it: the server keeps the thinking's start
(`r.birdieAt`) and sends it, and the screen starts from that.

## Checked, no finding

1. **The game is untouched.**
   - Hang on only sets `popOff: { at, hangOn: true }` and holds the think (`popOffMs`: `hangOnTimeline().total + tailMs`, 12.9 s), on
     the server (`thinkMinAt`, then `playBoss` holds the move in `bossPlay`; the `bossTimeout` timer gets replaced, so it can't fire
     during the hold) and in solo (`landedMs` → `bossThinkMs`).
   - The board change is screen-only: `hangOnFen` builds a fen for display, and the game's board is never touched.
   - The clock is screen-only too: `DockClock` keeps `real` in `h.ms` and only displays `hangOnClock(real, t)`. Once `upAt` passes it
     shows `real`, and so it does after `total`, when the interval is cleared and `gagAt` goes undefined.
   - The chess test that runs the same battle with and without `hangon` (same history, clocks and bank) covers this.
2. **The scramble's seconds by use.**
   - `ults` counts only Time Scrambles. The Rush never calls `unleashed`, and the dispatcher calls it once, after `rules.ultimate`
     (`boss-powers.ts:141-142`).
   - So the event's `scrambleSecondsOf(ults ?? 0)` (counted before it's incremented) and the clock's and the view's
     `scrambleNow` (`ults - 1`) agree: 5, then 3.
   - The server's deadline (`moveClock` → `dashMoveClock`), solo, the countdown and Tick's tally (`d.scramble.seconds`), the banner
     (the view's seconds) and the FAQ all read them.
   - On a rejoin, the seconds come from the state's `ults`, so they're right.
   - On a three-boss tower floor (`ultMax` 1), only the first Scramble ever comes: 5 s.
   - Nothing else reads `scrambleSeconds` as a plain number (searched the repo).
   - The late-pick grace is unchanged, and the lobby test still checks the deadline plus `lateGraceMs`.
3. **The counting.**
   - Only the second of the `popOffTurns` gets `hangOn`.
   - `popOffPending` now requires `crowdMoves === powers.turn`, and solo and the server read the same function. So the extra-move
     thinking never plays or holds the gag.
   - The server's `requestExtra` (and solo's `extraTurn`) never held it before either.
4. **Pre-moves.** `watch` blocks new premoves, and blocks the tap that cancels them, during the gag. The "your turn with premoves
   waiting" effect is gated on `!watch`, so the slid-back fen, which has your side to move, can't fire a premove. Hiding the page is
   fine: everything is timed by the wall clock and recomputed on the next render.
5. **Tests.** The changed checks follow the rule change (5 × 3 s → 3 × 5 s, two pop-offs → one plus Hang on, `crowdMoves` added to the
   fixtures because of the new condition, and the animation list). None is looser, and the new ones are real. No
   `docs/rules/eric.md` guard was touched.
