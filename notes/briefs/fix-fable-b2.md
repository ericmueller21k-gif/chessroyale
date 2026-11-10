# Fix round: PR #610 (rewards, records and fair play)

The independent review is `review.md` on branch `review/fable-b2` (`git show origin/review/fable-b2:review.md`), with its
proof tests in `review-b2.test.ts` on that branch. Work on claude/fable-b2 (PR #610, head 2970b78 or later; pull first).
B1 is already fixed by the director (2970b78: the spec checks the reviewer's 409, then a real admin bans through the API).

## Do (the director's calls)
- **M1:** take the review's step 4, the audit's own alternative: **the reviewer token never bans** (review, watch and clear only;
  a ban is a person's). Remove the ban-bar path for the reviewer; update the e2e and unit checks and `docs/fairplay-reviewer.md`.
  The decision note says: automatic bans stay off (`enforcement: "review"`) and the deep re-check's own facts (steps 1-3: store the
  search's gap, best expected score and crowd recount, have `skipReason`/`matchSignals` prefer them, and strength from deep losses)
  come before Eric turns bans back on. Don't build steps 1-3 now; add a ROADMAP line under fair play.
- **m1:** on `!added`, still queue the deep re-check (when flagged) and `actOn` (safe to repeat, per the review).
- **m2:** arm the alarm and dispatch the engine queue first, then the write in the background
  (`this.ctx.waitUntil(this.writeResults().then(() => this.armAlarm(core)))`, or don't await a write another event started).
  Prove with the review's m2 test.
- **m3:** go lenient by time, not tries: store when a result first failed; lenient only after 30 minutes (a setting). Or keep the
  soft parts queued on their own once the row is in; pick the least code.
- **m4:** stop deep-checking a match once it has `banMatchChecked` counted moves unless the case is in review; take a position's
  whole budget before its first search (no half-searched positions thrown away). `dailySearches` unchanged (spend is Eric's).
- **m5:** the app treats 401 and 429 like 404 for the rest of the game; solo's limit is `min(soloDailySearches, a third of the
  day's searches)`. Note in the PR body that 200 a day is unmeasured against a keen solo player.
- **m6:** a solo game counts for the Welcome Crate with `XP.minMoves` moves and at least 60 s of the server's time (a setting),
  not 3 minutes. Old untimed rows: leave (pre-launch, Eric's accounts only); say so in the PR body.
- **m7:** one line in the decision note (the token can still put an account in review; review keeps it out of ranked until a person
  clears it).

Copy the review's proof tests into packages/server/test/ and turn each into a test the fix passes (M1 → the reviewer's ban is refused
outright). Lane: full; effort xhigh. Run locally only the tests you write or change and the server unit suite; the e2e you change.
Update the PR body file `.pr-body.md` (the director's current body is on PR #610: changed checks old → new, including
`e2e/fairplay.spec.ts`), then push. Write `.review-fixes.md` (each finding: what you did, or why not) and push; don't open a PR.
Read CLAUDE.md and notes/briefs/rules-common.md first.
