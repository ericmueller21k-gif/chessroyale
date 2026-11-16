# 50 v 50 Party follow-up (after #747). Opus, xhigh (lobby logic and per-player ranking). Targeted lane

About 45 minutes. Branch `claude/crowd-party-followup` from main. The review: `git show origin/review/crowd-party-delta2:review.md`.
Read `docs/areas/matchmaking.md` (or the party's area page) first.

1. **leave() bug:** a member who taps Leave while the party is placed (before the fill) stays in the group's `ids`
   (`packages/server/src/lobby.ts` `leave()`, ~1204), so the friend left behind plays alone yet `partied`, unranked, with the
   "Party matches aren't ranked" line. Drop the id from its `crowdParties` group on leave (its seat reopens for a return with the
   pass while the hold lasts). A unit test in `crowd-party.test.ts` that fails without the fix.
2. **L1:** after the Find match at `crowd-party.test.ts:175`, send `cancel` and expect `P.view().stopped` undefined (red without
   `squads-party.ts` `delete this.r.awayStopped`).
3. **L2:** `e2e/friends.spec.ts` M2: `partyfill=45` → `70` so (b) has room after (a)'s 21 s wait. Run that test, phone.
4. **Nit:** `settings.ts` `CROWD_PARTY.ranked` comment: it applies to the party's members only.

Checks: typecheck, the server unit tests you touched, the one friends.spec test. Push; write `.pr-body.md` (short: what changed,
player-visible, changed checks old → new) and `.done`. Commits end with the `Claude-Session:` line only, no model names. No PR.
