# Dash stall: the review's fixes, into PR #770. Opus, high (clear fixes with tests; server timing)

Branch `claude/dash-stall` (PR #770, head 5bfb01d): check it out and push to it (no new branch). About 45 min. Read CLAUDE.md and
the review: `git show origin/review/dash-stall:review.md`. Fix these, each with a focused test that fails without it:

1. **Once a battle means the whole skit (Eric: "this only fire at once 1 time per game").** Director's call: option (a). Spend the
   skit when the slam starts (`dash.stall` recorded at the slam, solo and server). If the move goes in before the fake move, the fake
   simply doesn't come and there's no second slam later. Change `dash-lobby.test.ts:273` (it asserts the slam comes again) to assert
   it never does; list it under "Changed checks" (old → new). Update the decision note and `docs/areas/bosses.md` (Dash).
2. **Solo: stall timer outlives halt/dispose.** `halt()` clears the stall (`clearStall()`), and `stallBeat` returns at once when
   `this.stopped`.
3. **Server: a late stall alarm reopens a passed round.** In `stallBeat`, if `now >= round.deadline` (or within `marginMs/2`), drop
   the beat (`st.next = undefined`) and `armRound()` without pausing anything.
4. **Finding 6:** check with `npm run frames:boss` on `?boss=dash&power=clocktap`. If the `clockTap` event quiets his boss-move line
   or starts a power animation/sound, leave it out of the `quiet` test and give the moment no kit. If not, say so.

Not in this PR: finding 4 (watchers' clocks not told of the pause; the King's strike has the same gap) and 5 (lock during the hold):
the director queues them.

Run: typecheck, the dash unit tests (core/chess/server/app), `e2e/dash.spec.ts` on phone. Then rewrite `.pr-body.md` (the PR's body
plus a short "Review fixes" section and the changed check), push it with a `.done`, end. No PRs, no CI waits.
