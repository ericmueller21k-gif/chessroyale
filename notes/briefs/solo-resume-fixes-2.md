# Fix round 2: PR #885 (solo Resume / Forfeit). Opus, xhigh, alone

Branch `claude/solo-resume` (PR #885, full lane). The delta re-review is `review-885-delta.md` on branch `review/solo-resume`
(`git show origin/review/solo-resume:review-885-delta.md`), its failing cases in `review-885-delta.test.ts` there (each passes while
its hole is open: flip them into real tests in `app/test/solo-resume.test.ts`). Read CLAUDE.md, `.claude/LESSONS.md`, the decision
note `docs/decisions/2026-11-22-solo-resume.md`, the first review `review-885.md`, then the delta. Fix, one commit per finding, push each:
- **D3 first** (a one-tab phone locked out for 10 minutes): director's call, the review's "less code" fix: drop the `KEPT_ELSEWHERE`
  refusals in `takeKeptSolo` / `forfeitKeptSolo`, and the card's live-note gate (`keptOnLoad`, `reofferKeptSolo`). The tab token
  already makes a takeover safe. This also settles DN3. Update the decision note's two-tab lines.
- **D1**: keep the bots' planned picks with `pending` (`picks: [...runner.planned]`) and put them back after `deal()` on the rejoin
  (the small fix, not seeding the bots by round).
- **D5**: `pending.king: true`; the rejoin puts you back in `kingCallers` (and `kingCalled`) before scoring.
- **D4**: keep the turn as a power-up is used (a `powerUp` mark on the kept turn); the rejoin's turn starts with it spent (`hint = []`,
  the hints fetched again). Floors too.
- **D2**: director's call: keep the time into the Dodge as the page goes (as `turnMs` keeps a turn's: `dodgeMs`) and back-date the
  round's `at` to it on the rejoin, so its teleports have already shown and the vote has only its own time left.
- **Nits:** DN1 (fix the words: the losing hit is kept, a rejoin goes to the loss), DN2 (end the stopped tab's step: a `stopped`
  check after each `keepFloor`), DN4 (`end()` clears only when this tab holds it).
Prove it with the typecheck, the app and server unit tests, and `e2e/xp.spec.ts` (phone) locally under the e2e lock. Append
"Review fixes, round 2" to `.pr-body.md` (each finding → what changed; changed checks old → new), then write `.done` (replace the old
one), push and stop. Don't open PRs or wait on CI. Commits end with the `Claude-Session:` line only. About an hour.
