# Dash clock tap (#775): the review's fixes, into the PR. Opus, high (clear fixes with tests)

Branch `claude/dash-tap-slow` (PR #775, head 57b2c26): `git fetch origin claude/dash-tap-slow && git checkout -B claude/dash-tap-slow
origin/claude/dash-tap-slow`, push to it. About 45 min. Read CLAUDE.md and the review: `git show origin/review/dash-tap-slow:review.md`.

Fix, each with a focused test that fails without it:
1. **Only the players still thinking see it.** A player who already moved (raid: the phase is `scoring` for them; a party: they have
   `myPick`) never gets the crawl or the joke line. Simplest: `DashTap` starts only when the tap is first seen in `play` with no pick
   of yours; a pick ends it for you (he gets up). Keep `r.last` so a reconnecting player who hasn't picked sees him lying.
2. **The tick doesn't loop forever:** his idle's tap sound plays for the first ~3 s after he's down (`DASH_TAP.tapMs`), then the taps
   go silent (the animation keeps going). One setting.
3. **Solo and server agree near the deadline:** the tap's margin goes into `stallPlan` (`tapMs <= allowedMs - DASH_STALL.marginMs`),
   so neither side starts a crawl in the last second; the solo-only check goes.
4. Finding 4 (his reply's slap animation hidden while he finishes the joke): accepted for now (Eric: "let the crawl finish"); note it
   in the decision file. No code.

Run: typecheck; dash unit tests (chess, server, app); `e2e/dash.spec.ts` phone. Rewrite `.pr-body.md` (add a short "Review fixes"
section, changed checks old → new), push it with `.done`, end. No PRs, no CI waits.
