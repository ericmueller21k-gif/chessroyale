# Fix round 2: PR #601, from the delta review

Branch claude/fable-b1. Read `delta.md` on orphan branch `review/fable-b1` (and its proof test `zz-delta-b1.test.ts`
there), then `.review-fixes.md` on the PR branch. Fix exactly these, each with a test:

1. **Blocker 1, the claimed class.**
   (a) In `drawJudges`, pair the second judge by the first's class only when that class has at least 3 other owners left
       in the pool; otherwise draw the second from everyone. A claimed class must never decide the second judge.
   (b) Make the speed cap relative: weight on `min(nps, JUDGES.maxNps, 4 × the median nps of the pool)` (or the class's
       median, if that measures better). Keep real computers pairing together in the review's lobby.
   Add the delta's table as a test: the review's lobby (20 computers 2M, 78 phones 300k), 98 phones, 62 phones, and 3
   computers + 95 phones, each with two attacker accounts claiming "computer" at 3M, and with no speed lie. Assert the
   both-attacker share stays at or below about 5% in every row, and the mixed-pair share in the review's lobby stays low.
   Put the worst case across all rows in `docs/decisions/2026-11-10-judge-pairing.md`.
2. **Minor 2:** a refilled judge (and the late/referee paths, where it makes sense) is drawn with the remaining judge's
   class, under the same threshold (an optional `kind` argument).
3. **Minor 3:** ROADMAP line (a "one" answer on a Squads job that pays something gets a server spot check).
4. **Nits:** fix the `judges.test.ts:216` comment, and write `sameParty` as `!!pa && pa === pb`.

Effort xhigh. Run the server and core unit tests. Push to claude/fable-b1; update `.review-fixes.md` (a "Round 2" section)
and `.pr-body.md`; push. Don't open or merge anything.
