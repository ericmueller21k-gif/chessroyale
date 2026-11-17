# Boss facing (#774): Timber on a computer stands too far over the board. Opus, high (rendering; one red e2e)

Branch `claude/boss-facing` (PR #774, head 733f672): `git fetch origin claude/boss-facing && git checkout -B claude/boss-facing
origin/claude/boss-facing`, push to it. About 30-45 min. Read CLAUDE.md, `.claude/LESSONS.md`, the PR's decision
`docs/decisions/2026-11-17-boss-facing.md` and the diff (`git diff origin/main...HEAD`).

**The red check (CI, desktop project, failed twice):** `e2e/timber.spec.ts:165` "on a computer his figure stands beside the board at
rest (his drawing over the board's edge by at most SIDE_FEEL.over of its side…)": `Error: rest 101,555,387,822 over the board
346,63,1106,823 by at most 0.05 of its s[ide]` — his drawn box (x 101-387) reaches 41 px into the board (from 346); 0.05 of his
~286 px side is ~14 px. Before #774 this passed: Timber is newly mirrored on the computer side (or his room/`SIDE_REACH`/`fitSides`
for a mirrored figure is measured wrong for his frame).

Find the cause (his art's facing call, the mirrored room swap in `fitSides`, his `SIDE_REACH`, or the spec's mirrored pixel read) and
fix it there, not by loosening the spec's limit. Check the other bosses on the computer side use the same path correctly (the
boss-side spec's per-boss test). Run: typecheck; `npx playwright test e2e/timber.spec.ts e2e/boss-side.spec.ts --project desktop`.
Push the fix, an updated `.pr-body.md` (add a line under "What changed" and any changed check) and `.done`. End. No PRs, no CI waits.
