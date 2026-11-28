# Independent review: town phase 2 (PR #1051, branch `claude/town-phase2`). Opus, xhigh, read-only. Full lane. About 45 minutes.

xhigh: it changes how the town makes and uploads every device-made picture and its loading screen; a bug there is lag or a broken town.

Read `notes/briefs/rules-common.md` (load first, then show), `DESIGN.md` §2 on `origin/claude/town-architecture`, the author's notes
(`.done` and `.mockup` on the branch), and the 1c review (`REVIEW.md` on `claude/town-phase1c-review`). Review
`git diff origin/main...origin/claude/town-phase2`. Look hardest at:
- **The picture service (`town/picture-service.ts`):** every device-made picture goes through `svc.ask`; nothing is made or uploaded
  inside a frame (grep for any upload path left in paint-gl.ts or elsewhere). The slice after each frame (3 ms) can't starve: a
  burst of arrivals (67 players) settles; a picture asked for and never drawn is let go; nothing asked for twice is made twice.
- **Load first, then show:** everything the first frame needs is made under the loading card, so the first shown frames don't fill in
  (the sky, the statues, the goodbye bubble, the visible tags). A picture "left out until ready" must never be the player's own tag or
  anything in view on the first frame.
- **Atlas groups and eviction:** a freed place reused without a stale picture drawn in it; never evicts one drawn this frame or last;
  a full group can't loop or hang; text pages on a phone (2) enough for a busy town; no page reset path left.
- **Pixel ratio and lost context:** DPR change (`picOneSizeFrom` 1.5 boundary, a window dragged between screens) remakes what it must;
  after a lost WebGL context every device-made picture comes back; iOS Safari specifics read from the code (nobody can run it here).
- **Boss lines:** `bossNextLine` / `lineReady`: a boss can't go silent forever if a bubble never gets made; online and solo match.
- **Fails the load instead of painting** (a roof or glow not baked): can a real build hit it (an admin town, a new building)? That
  would be the Retry card for everyone.
- **What was deleted:** nothing still imports it; the changed checks (PR body) still guard what they guarded.
Write `REVIEW.md` (blockers, should-fix, nits with file:line and a failing case; Checked; Not reached) on `claude/town-phase2-review`
from the PR head; commit AND push with `.done` (`git add -f`), check `git ls-remote`, stop. No code fixes, no PRs, no comments.
