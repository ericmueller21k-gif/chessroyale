# The 50 v 50 Party, fix round 2 (PR #747). Opus, xhigh, alone

Effort xhigh. `hub` delegate across matchmaking. Branch `claude/crowd-party` (check it out from origin; merge origin/main first).
Include `notes/briefs/rules-common.md`. The delta review: `git show origin/review/crowd-party-delta:review.md`. The first:
`git show origin/review/crowd-party:review.md`.

## Do
1. **The red e2e (first):** `e2e/town-chat.spec.ts:1384` [phone] failed on BOTH tries on 7776a90 (`canvas.town-canvas` never found in
   40 s). This PR changes the app's start (it reconnects a 50 v 50 party). Run that test locally on this branch and on main (a few
   times each). If the branch breaks it, find the cause (e.g. a party reconnect on load taking the page off the town, a signed-in
   player with a stale party marker) and fix it; if main fails the same way, say so with the numbers and fix the test's cause.
2. **N1:** hold seats for every member, not only connected ones (`const size = this.r.members.length`); a test (an away member at
   Find match still lands on the party's team).
3. **M3 / N2 (director's call, the delta review's recommendation, until Eric answers):** keep singles ranked; only the party's members
   are unranked (`rankedFor(h)` for members of a group of 2+; the results message per player: `{...msg, ranked: false, partied: true}`
   with its own line "Party matches aren't ranked" in Results.tsx, not "fewer than 30 real players"). A unit test: two singles ranked,
   two members not. The setting stays (`CROWD_PARTY.ranked`).
4. **N4:** `crowdPassOpen` also requires `p.until > now`.
5. **N3 (a call: accept, documented):** say in `docs/areas/matchmaking.md` that a party arriving with less than the hold left makes a
   new lobby (singles move to it), and why.
6. **N5:** when `awayStopMs` ends a search, the party screen says so in one line ("The search stopped: everyone was away."), on top,
   pushing nothing; fix the M2(a) test gap (fulfill the route with `{open: true, phase: "playing"}`, then unroute and reload).
7. The `unit` job hit vitest worker timeouts on 7776a90 (all tests passed). Your push re-runs it; if it times out again, profile the
   unit job and fix the cause (a test leaving timers or sockets running, or the new files' load).

Run the touched unit tests and the party + town-chat e2e locally. Rewrite `.pr-body.md` (this round's fixes and changed checks; keep
the first rounds' notes) and write `.done`. No PRs, no CI waits, no model names in commits. Push work in progress at each step.
