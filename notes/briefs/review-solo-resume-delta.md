# Delta re-review: PR #885 (solo Resume / Forfeit), read-only, ONE round. Opus, xhigh, alone

The first review (`review-885.md` on branch `review/solo-resume`) found I1-I4 and N1-N4. The fix round is the commits on
`claude/solo-resume` after 53b527d0 (`git log 53b527d0..origin/claude/solo-resume`; diff `git diff 53b527d0 origin/claude/solo-resume`).
Read CLAUDE.md, the first review, the PR body's "Review fixes" section (PR #885) and the decision note
`docs/decisions/2026-11-22-solo-resume.md`. Then check:
- Each of I1-I4 and N3 is truly closed (re-run the first review's `review-885.test.ts` cases against the branch, flipped as needed).
- What the fixes could break: the tab token (a single tab reloading its own game, a tab that sleeps then wakes, a guest joining an
  account, a tower floor and a boss battle in two tabs, storage events in the same tab); `KeptGame.pending` (a pending move from an
  older kept game, one that's no longer legal, a power-up spent twice, the judge's answer racing a reload; tower floors too); the
  Dodge kept per round (a hit that ends the battle, round counts, its clock back-dated); `noteEnded` clearing the kept game (never
  before the result is kept unsent); `askForfeitFirst` moved to `account.ts`; a resume that now rejects (N3) on every path.
- Dodges and double counts still closed (the first review's "checked, fine" list), and the screens (nothing hidden, nothing shifts;
  "Played in another tab." and the refusals on home's error line).
Rank: important / nit. Don't fix. Write `review-885-delta.md` plus an empty `.done2` on the same branch `review/solo-resume`
(fetch it, add your files, push). About 40 minutes. Commits end with the `Claude-Session:` line only.
