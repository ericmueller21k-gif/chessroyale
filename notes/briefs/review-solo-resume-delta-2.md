# Delta re-review 2: PR #885 (solo Resume / Forfeit), read-only, ONE round. Opus, xhigh, alone

Two reviews so far, both on branch `review/solo-resume`: `review-885.md` (I1-I4) and `review-885-delta.md` (D1-D5, DN1-DN4), each
with its test file. Fix round 2 is the commits on `claude/solo-resume` after 02f704dd (`git log 02f704dd..origin/claude/solo-resume`).
Read CLAUDE.md, both reviews, PR #885's body ("Review fixes, round 2") and `docs/decisions/2026-11-22-solo-resume.md`. Then:
- Each of D1-D5 and DN1-DN4 truly closed (re-run `review-885-delta.test.ts` against the branch; its cases should now fail).
- What round 2 could break: D3 dropping the live-note refusals (a real second tab now: the tab token alone must keep it safe);
  `plannedPicks()`/`restorePlannedPicks()` in `packages/chess/src/runner.ts` (shared with online and the sims: any change when
  nothing is restored?); `pending.king`, `KeptGame.powerUp`, `dodgeMs`/`dodgeVote` (old kept games without them, tower floors, a
  power-up spent twice or never); the `stopped` checks (a step that should go on and now stops).
- Stay inside what round 2 touched: don't re-audit what the first two reviews passed unless round 2 changed it. Rank important /
  nit, and only count as important a way to dodge or undo a result, a double count, a crash or a stuck screen.
Don't fix. Add `review-885-delta-2.md` and an empty `.done3` to branch `review/solo-resume`, push and stop. About 40 minutes.
Commits end with the `Claude-Session:` line only.
