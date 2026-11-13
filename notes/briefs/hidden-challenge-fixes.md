# Fix round: PR #673 (the Hidden Boss's room challenge)

Effort xhigh (server, an online match start, ban checks). Branch `claude/hidden-boss-challenge` (PR #673, full lane, `full-e2e`).
Read CLAUDE.md, then the review: `git fetch origin review/hidden-challenge && git show FETCH_HEAD:review.md`.
Fix in this branch; the director's calls on each finding:
- **M1 (bans): fix as the review says.** The same `banCheck` (account and device cookie) on `enter` and `challenge`, cached beside
  `whoIs` (at most once a minute); 403 with `banned: true` so the app shows the ban notice. A unit check with a banned row.
- **m1 (cancel/leave/re-enter racing the start): a seat in a starting request is kept.** `cancel` and `enter` keep an unread
  `kind: "fight"` outcome, and the `cancel`, `leave` and `look` answers carry it, so a device that tapped Cancel or "Leave and cancel"
  just as the fourth joined hands off into the fight like the others (the summoning has started for everyone). A closed tab
  (`pagehide`) leaves its seat empty: the others start at `joinWaitSec`, as today. Unit checks for cases a, b and c.
- **m2 (kill switch): fix.** `hiddenFight` checks the pause (`boss:recluse` and `raid`) and ends the request with the pause line, so
  no fight starts on another boss under his name. A unit check.
- **m3 (forced win stored as a team win): accept, as solo's Win this form does.** One line in the decision note.
- **m4: `hiddenDrop` off the critical path** (`ctx.waitUntil`). The other entry points (PLAY, party START, Squads, 1v1) don't drop a
  room request: record that in the decision note as a known gap (only an admin-tested, two-tab case); no change.
- **n1: correct the comments** (the town's own away rule drives the idle drop), no new code.
- **n2: the count shows from the start**, "Challengers 0 of 4" in the same place, so it never appears from nothing. The admin's
  "Fill with 3 bots" stays admin-only (an admin tool, like the 🏆): note it in the decision note.
Prove it with the server and core unit tests, typecheck, and `e2e/hidden-boss-room.spec.ts` (both projects) under the e2e lock. Add
to `docs/decisions/2026-11-13-hidden-boss-challenge.md` (a short "Review round" section). Write `.pr-body.md` with a short
"Review round" addendum appended to the current PR body (the PR body is `gh`-less: read it from the director's copy below), commit,
push, then push `.done`. Don't open PRs. Don't put model names in commits. About an hour.
