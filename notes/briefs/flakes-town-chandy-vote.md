# Two more e2e flakes (Nov 19). Opus, medium. Light lane (tests only, unless a cause is in the app)

CLAUDE.md: a flake is fixed at its cause, never hidden. Branch `claude/flakes-town-chandy-vote` from main. Read `.claude/LESSONS.md`.
1. **`e2e/town.spec.ts:221`** (an old tab after a deploy: a challenge opens its room from the tab's own version), phone. Failed both
   tries on PR #812's run 44467157290 (shard 2) at line 246: the poll for `{ next: true, caches: [version, next] }` timed out after 60 s
   with `next: false` (the new worker at `/api/e2e/sw.js` never `activated`). Passed on #812's two earlier full runs and 3 of 3
   locally; #812 doesn't touch the worker or that route. Look for why activation can stall under load (a waiting worker never told to
   skip waiting, a controller race, the poll reading `active` before it settles, the test's update trigger racing the page). If the
   cause is in the app's service worker (a real deploy could stall the same way), fix it there and say so plainly.
2. **`e2e/chandy.spec.ts:298`** (Dodge's vote, round 3): the vote button stayed "not stable" until the vote closed, so the tap timed
   out (seen locally on `--repeat-each=10` after #813's fix). Find why it's never stable (the clones' teleport animation moving the
   grid? a transform on the button?) and fix the cause: if a player's tap could miss the same way, that's an app fix.
Prove each with `--repeat-each` before (if it reproduces) and after. `.pr-body.md` (under 25 lines, changed checks old → new);
a five-line decision note only if a call is made. Done: `.done`; push and end. No PRs, no CI waits. Commits end with the
`Claude-Session:` line only.
