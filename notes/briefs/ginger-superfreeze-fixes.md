# Ginger Super Freeze (#787): the review's visual fixes, into the PR. Opus, high

Branch `claude/ginger-superfreeze` (head 0b32828): `git fetch origin claude/ginger-superfreeze && git checkout -B claude/ginger-superfreeze
origin/claude/ginger-superfreeze`, push to it. About 45 min. Read CLAUDE.md and the review: `git show origin/review/ginger-superfreeze:review.md`.
Fix findings 1-3 (all visual/wording), each with a focused check:
1. The regular Freeze's ice stays on its piece through the Super Freeze moment (don't blank a square already iced before it).
2. Pieces let go (to leave a legal move, or taken) melt with the existing melt as the crowd's turn starts instead of blinking out; the
   banner counts only the pieces actually held (or words it so it can't overcount).
3. The meter doesn't glow "ready" while the Blizzard holds it back: full but dim, labeled "Super Freeze: waits for the Blizzard"
   (a `waiting` flag in the view, from the same test `afterCrowdMove` uses).
Finding 4 (a draw on his move replays thinking moments) is a shared pattern across bosses: NOT here; the director runs it separately.
Run typecheck, Ginger unit tests (chess, app, server), e2e `ginger.spec.ts` phone. Update `.pr-body.md` ("Review fixes", changed checks),
push it with `.done`, end. No PRs, no CI waits.
