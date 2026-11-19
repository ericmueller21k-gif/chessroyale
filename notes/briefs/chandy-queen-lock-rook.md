# Chandy: the queen lock aims at your best rook when your queen is gone (Nov 19). Opus, high. Boss lane

Eric, Nov 19 (on the director's proposal "when the queen is gone, Chandy's queen lock targets the best rook"): "yes on chandy good idea".
Why: the queen lock was a dead upgrade in games where the queens came off early (Eric's playtest, Nov 18).

Branch `claude/chandy-rook-lock` from main (pull first). Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/bosses.md` (Chandy's row),
`docs/decisions/2026-11-18-chandy-queen-lock-first.md`, `2026-11-18-chandy-move-mix.md`, then `packages/chess/src/bosses/chandy.ts`.
- The queen lock aims at your queen; with no queen of yours it can aim at, at your best rook (pick "best" simply: the rook the
  engine's eval or the existing `lockRank` values most, ties from the seed; record the call). With neither, it can't come, as today.
- Everything that names the target follows: `queenLockFirst` (the first unlock when it could come), the meter's "can it land" check,
  the shot's "first piece between", the aim marks, refused-tap text (`refused.ts`), the weapon screen's text and the FAQ/rules text
  that says "queen" (American English, plain words: "your queen, or your best rook if your queen is gone").
- Solo and online agree (the server's Chandy file if it names the target). Several bosses (Battle Tower, just merged): Chandy's
  `followLocks` must follow the rook target as it does the queen.
- Tests: a focused check in Chandy's existing tests (queen gone: the lock aims at the rook and the shot lands), the boss kit, the
  boss smoke. One still for Eric: the rook lock on a phone (`npm run frames:boss` style). Decision note about five lines.
Effort high (a boss's rules with screens). Done: `.pr-body.md` (lane: boss; changed checks old → new) and `.done`; push and end. No PRs, no CI waits.
