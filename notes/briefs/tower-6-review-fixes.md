# Battle Tower PR 6: the review's fixes (Nov 19). Opus, xhigh, alone. Full lane (then a delta re-review)

Branch `claude/tower-several-bosses` (PR #808; pull first). The review: `git fetch origin review/tower-several-bosses && git show
origin/review/tower-several-bosses:.review.md`. Read it in full, then CLAUDE.md, the design §2, `docs/decisions/2026-11-18-several-bosses.md`.

Fix findings 1-4 and the Hollow note **at their causes** (CLAUDE.md, Nov 13), the review's suggested fixes as the starting point:
- **The root (findings 1a, 4):** a hook's "the bosses are to move" means "this boss is to move": `bossToMove()` for the boss in focus
  to move only, worked out before the hooks run. Decide per boss for Ginger's Super Freeze, Babur's balloons, Chandy's queen shot
  (each "as alone": his own turn), and record each in the decision note.
- **1b:** Smudgy's forced move binds only him (a finer stop than `ownStops`); his disguise still binds the whole side.
- **2:** every move on the board reaches every boss's trackers (a `followMove` for all bosses on every move, the crowd's and each
  boss's, like `followLayer`); Smudgy's unmask checks when another boss moves his rook (or: another boss may not move the hidden rook;
  pick the simpler that's correct, and say why). Check the same cause for marks on the crowd's pieces (Chandy's locks under Alfil's
  Slam or Jefferson's fire).
- **3:** Folio's possible cross-out runs first; a crossed-out move skips the others' `afterCrowdMove` and leaves their `judged`.
- **The Hollow note:** the next boss's ultimate step from the order, not the focus, during Hollow's extra move.
- **Tests that would have caught them:** the review's kit invariants (tracked squares hold a piece of the side; a boss's allowed
  moves never only another boss's forced move) in `boss-kit-side`, and fix the two weak checks it names in `several-bosses.test.ts`.
  Each fix's test fails before it (show it).
**Not yet:** Eric's calls on the two known pair breaks (Smudgy + Alfil, Alfil + Jefferson) stay as `PAIR_BREAKS` until he answers.
**The 1-boss guard still holds:** no existing assertion edited for one boss; the chess suite, the layer twins, server boss and parity.
Done: an updated `.pr-body.md` (add a "Review fixes" section; under 70 lines in all) and `.done`; push and end. No PRs, no CI waits.
