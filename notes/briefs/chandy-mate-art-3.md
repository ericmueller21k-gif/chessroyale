# Chandy's checkmate art: the review's fixes (Nov 26). Opus high. Characters lane. Branch `claude/chandy-mate-art`.

You are the `characters` delegate. Read the review: `git show origin/claude/chandy-mate-art-review:REVIEW.md`, and the branch's
`.pr-body.md`. Work on `claude/chandy-mate-art` (merge `origin/main` first). The director's calls:
1. **Finding 1 (the bolt off his arm): do both (b) and (c).** (b) Add steeper reaches to `REACH_DIRS` so his arm can point up to
   straight up and down to straight down (e.g. U60, U90 and D90, drawn in phase 1's style: arm and claws only, the rest of the reach pose
   reused), and pick the reach whose hand direction is nearest the true direction to the king, measured from that reach's own hand
   (the review's (a)). (c) When the king is within about 1.5 squares of the board's center, he lands a square or two off the center,
   away from the king, so he never stands over the king and the bolt runs clear. Add a unit test over every king square, both crowd
   colors: the bolt's angle is within ~15° of his arm's direction, and his figure's box never covers the king's square.
2. **Nit 2:** chain his checkmate figure's warm-up onto the `done` of CHANDY's `prewarmSprite` so one slice works at a time (as that
   function's comment intends); leave the pre-existing staged build alone unless it's a one-line move into the same chain.
3. **Nit 3:** in `e2e/chandy.spec.ts`'s mate test, record his spot's visibility with each step and check one Chandy at a time (hidden
   while `.cd-mate-fig` is up, shown again after).
Watch it once frame by frame with real taps for a king in the center and a king on the far rank (a test position: `?boss=chandy&win=1`
mates on move 1, so add a test-only mate position or use the unit test's geometry and one e2e/still with the king advanced, your call,
recorded). Push 2 stills (king near the center; king on the far rank) to `stills/chandy-mate-art` (`chandy-mate/phase3/`). Append a
"Round 2" section to `.pr-body.md` (what changed; checks changed old → new). About an hour. At the end commit and push `.pr-body.md`
and a fresh empty `.done-r2`, stop. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`,
no Co-Authored-By. American English.
