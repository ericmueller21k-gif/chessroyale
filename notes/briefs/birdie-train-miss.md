# Birdie: the train rides even when you saved the piece, and misses (Nov 24). Opus xhigh, boss lane

Eric (Nov 24): "we still need to show the birdie driving his train across the board animation, even when there's no pieces to hit. He
just simply drives across and then everything misses."

Today (`packages/chess/src/bosses/birdie.ts`, `birdieBattle.afterCrowdMove`): when your move takes the warned piece off the line, no
ride happens at all (`trainOutcome` returns null: nothing on the square), so the warning just ends. Eric wants the ride every time his
warning comes due: the same ride (`BIRDIE_BEATS.ride`, the departure, the crossing at `rideMs`, the return), and nothing is hit.

Start: `git fetch origin main && git checkout -B claude/birdie-train-miss origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/bosses.md` (Birdie), `git show origin/claude/director-notes:notes/designs-birdie.md`.
Effort xhigh: the ride's moment holds his move online (the server's timing, `BIRDIE_FX`), so solo and online must agree.

1. **The miss ride.** When the warning for this crowd move is due (`w`, not `over`) and the warned piece is no longer there (moved, so
   saved), the train still rides the warned line: a new event (e.g. `trainMiss`, or `trainSmash` with a `missed` flag: your call, record
   it) with the line's squares and no smash. The board is unchanged; no base. Every piece still on the line, his and yours, steps aside as
   it passes (on screen only), exactly as his own pieces do today, so it reads as "everything misses". No warning sign, no shatter, no
   smash sound; the ride's own sounds (horn, whistle, rumble) as on a smash ride. Keep the existing rule that nothing rides once the game
   is over on the board, at the move cap, or with the battle decided.
2. **Timing:** the miss ride takes the same time as a smash ride (`BIRDIE_FX`), holds his move the same way solo (`playBoss`) and online
   (the server's moment hold: find every place `trainSmash` is timed or listed, e.g. `packages/server`, `bossMoveMoment`, the dock's
   lines), and his fall after it on the same turn still comes after the train. Check whether the warning is cleared when the piece moves
   before the ride (a different piece of yours moving onto the warned square must not be smashed: if it can be today, fix it and say so).
3. **Judge and fair play unchanged:** saving the piece still scores as today; the turn's `powerTurn` as today.
4. **Dock / God King:** if the dock or the God King say a line on a smash, a miss can say a short line or nothing (your call, plain
   American English, e.g. "Birdie's train rides by. Nothing hit!"); never a line claiming a piece was lost.
5. Prove: typecheck; chess `birdie` tests (a saved piece → a miss ride event with the line, board unchanged; a smash as before); server
   birdie lobby test if the hold lives there; the boss kit; `e2e/birdie.spec.ts`, one focused check (save the warned piece → the train
   crosses: its element moves across, and the board is the same after), phone and computer; Birdie's boss smoke. Watch the miss ride frame
   by frame once (`npm run frames:boss` or #909's recorder). Stills on a new orphan branch `stills/birdie-train-miss`: 6 frames of a miss
   ride on the phone. Decision note of about five lines. Area page (bosses.md, Birdie). PR body in `.pr-body.md` (what changed,
   player-visible, changed checks old → new). Then `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert.
   Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model
   names). Never write the Hidden Boss's name. American English.
