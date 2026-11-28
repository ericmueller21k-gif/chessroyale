# Independent review: town phase 1c (PR, branch `claude/town-phase1c`). Opus, xhigh, read-only. Full lane. About 45 minutes.

Read `notes/briefs/rules-common.md` (load first, then show), `DESIGN.md` on `origin/claude/town-architecture`, the author's notes
`notes/briefs/town-phase1c-done.txt`, and the 1b reviews (`REVIEW.md`, `REVIEW2.md` on `claude/town-phase1b-review`). Review
`git diff origin/main...origin/claude/town-phase1c`. Look hardest at:
- **No painting fallback any more:** every way the town could be left without pictures (a file failing always, a decode failing, the
  atlas full, a lost context mid-load or in play, the worker's cache cleared, a half-deployed site, an old tab after a deploy): the Retry
  card or the pictures, never a half town, never a hang. iOS Safari specifics (context loss in the background, `createImageBitmap`,
  `Painter.read` via readPixels) read from the code, since nobody can run Safari here.
- **The waits with no time cap** (fonts, crate items, rides): each one settles (in or failed), so the card can't hang; the 15 s stall is
  the only way out and is reported.
- **`release` and `reopen`:** a page closed once uploaded is never read again except through `Painter.read`; after a lost context
  everything comes back (the reopen fetch, the cut-under-the-card readers); no leak of canvases.
- **Rivet / the sidekick frames:** the admin and player towns each fetch only their files; frames padded so smoothing never reads a
  neighbor.
- **What was deleted:** nothing still imports it; no switch left dangling; the old IndexedDB deleted once.
Write `REVIEW.md` (blockers, should-fix, nits with file:line and a failing case; Checked; Not reached) on `claude/town-phase1c-review`
from the PR head; commit AND push with `.done` (`git add -f`), check `git ls-remote`, stop. No code fixes, no PRs, no comments.
