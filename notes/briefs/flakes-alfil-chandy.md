# Two e2e flakes on main (Nov 19, run of dbc4ec7, both passed on retry). Opus, medium. Light lane (tests only, unless a cause is in the app)

CLAUDE.md: a flake is fixed at its cause, never hidden. Branch `claude/flakes-alfil-chandy` from main. Read `.claude/LESSONS.md`.
1. **`e2e/chandy.spec.ts:297`** (Dodge's last chance): first try saw phases `scope, volley, open, vote, locked` (no `slide`). The
   spec's rAF sampler (`watch`) only sees phases a frame lands in; a long CI frame skipped the short slide. The exact order is already
   the unit test's (`packages/app/test/chandy-wired.test.ts:76`, the timeline). Director's view of the cause: the e2e asserts frame
   samples as if every phase gets a frame. Check that (the slide's length at `pace=quick`), then make the e2e check what a frame sampler
   can promise (the samples in the timeline's order, scope / volley / vote seen) or read the phases from the timeline itself; say which.
2. **`e2e/alfil.spec.ts:247`** (Slam after a queen is taken): first try failed "he took your queen (the test's setup)": took 0. Find
   why (likely his natural meter brought the Slam before he took the queen, so the loop broke on its banner; confirm from the test's
   flow, or reproduce with `--repeat-each`), and fix the cause (e.g. the setup doesn't let the natural Slam come first: a test switch
   that already exists, or the loop goes on until the triggered Slam). No longer timeouts or retries.
Prove each: run the test with `--repeat-each=10 --project phone` before (if it reproduces) and after. Changed checks old → new in
`.pr-body.md` (under 25 lines); a five-line decision note only if a call is made. Done: `.done`; push and end. No PRs, no CI waits.
