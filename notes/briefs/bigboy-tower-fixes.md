# Big Boy's tower (#784): the review's fixes, into the PR. Opus, high (clear fixes with tests; rules + solo timing + CSS)

Branch `claude/bigboy-tower` (head 72c665f): `git fetch origin claude/bigboy-tower && git checkout -B claude/bigboy-tower origin/claude/bigboy-tower`,
push to it. About 1 h. Read CLAUDE.md and the review: `git show origin/review/bigboy-tower:review.md`. Each fix with a focused test that fails
without it:
1. **Lifetimes (Eric's rule):** scattered blocks go away at the END of the crowd's next turn, in every case. A crowd topple on turn T: they
   limit his reply to T and the crowd's turn T+1, then go (never his reply to T+1). A fall by itself or his topple: they limit the crowd's
   next turn, then go. Fix the code (and the screen's `scatterItems`) and make the FAQ say the same. Unit test: `bossAllowed` has no limit on
   his move after T+1.
2. **Solo's Big Bounce cuts your topple short:** `bounceTurn` uses the same think sum as `bossTurn` (`bigboyTurnMs`), as the server does. One
   e2e check (topple on a bounce turn: the tip ends before `.pm-bounce`).
3. **The tower hides square marks:** take one still to confirm; then the least-code fix that keeps the move dots, last-move, selected and check
   marks visible on and behind the tower (lift the marks above the under-layer, or make the tower's upper blocks semi-transparent). One focused
   check in `e2e/bigboy.spec.ts` (the dot on the tower's square is the top element there).
4. **His piece on a scattered block:** drop scattered squares any piece stands on (his too), as the crowd's case does. Unit test.
5. (Optional, skip if more than a few lines) a reconnect mid-topple starts from the server's hold.
Not in this PR (the director takes them to Eric): the Last Stand now effectively off against Big Boy; fair play's power turns.
Run typecheck, bigboy tests, boss kit, e2e bigboy phone. Rewrite `.pr-body.md` (add "Review fixes"; list changed checks incl. the three guard
tests touched by the first pass), push with `.done`, end. No PRs, no CI waits.
