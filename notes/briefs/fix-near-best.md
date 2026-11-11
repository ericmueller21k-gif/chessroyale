# Fix round: fair play near-best (PR #629, branch claude/fairplay-near-best). One round. Opus, xhigh

Branch `claude/fairplay-near-best` at origin's head (main merged in; `npm ci`). Read `CLAUDE.md` (full lane), include
`notes/briefs/rules-common.md`, the build brief `notes/briefs/brief-fairplay-near-best.md`, and **the review:
`git show origin/review/near-best:review.md`**. Eric's stance stands: better to pool than to miss; Release undoes it.

## Do (each with a test that fails before it)
1. **M1** (the evidence model, near-best ranked 4th+): the review's fix (`share([...top.slice(0, 3), m.move])` for p3) or better; re-run
   the near-best sim section once and update the report's numbers and the PR body (Eddie-like and strong people's pool/review rates).
2. **m1**: tag a sustained-strength verdict (`path: "strength"`); under `enforcement: "ban"` it raises a review, never an auto-ban. Pool mode
   unchanged (it pools).
3. **m3**: bound `recountDeep` to matches played before the deploy cutoff (a constant with a comment to remove it later), via the index.
4. **m4**: correct the decision note's honest max to the report's; one 1 v 1 row in the sim for sustained strength, or say plainly it's
   unmeasured there.
5. **m5**: the catch-up leaves a cleared (released) case untouched (test); the m1 review-branch test gets a non-bar match again.
6. m2 is calibration: say it plainly in the PR body (the 1-2 match target isn't met; the 2nd/3rd-choice cheater isn't caught; a burst design
   covers it next).

## Deliver
Push; write `.review-fixes.md` (finding → fix → test) and `.pr-body.md` (updated, ≤ 40 lines); `.done` LAST. Wait for green CI. Local: link
`@chessroyale/*` to THIS checkout's packages if you symlink node_modules.
