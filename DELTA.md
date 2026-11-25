# Delta review: PR #931, residents, server side (fixes 75f20d3b and e9afc0f4, head 86432678)

Independent, read-only delta review, Nov 25. Scope: `git diff 9b19454e 86432678 -- packages docs` against `REVIEW.md` on
`review/residents-server`. Ran in a detached worktree at 86432678: `npm run typecheck` clean; the whole server suite passes (99 files,
1481 tests). Each new or changed test was proven by reverting its fix alone and re-running (table below). Two throwaway probes (not
pushed) back the findings marked **(probe)**.

**Verdict: no blockers, no majors.** The three questions asked:

- **Can a lobby with a real person in it skip the engine server?** No. Every gate goes through `residentsOnly`: `serverOn`
  (lobby.ts:3742), `serverRechecks` (:3737), lobby-do's `scores` re-check (lobby-do.ts:640), and the new `phase2Search` / `warmEngine`
  getters (lobby.ts:875-881). It is now false while any non-resident seat is in `r.humans`, connected or not. A seat leaves `humans`
  only by `leaveMatch` (resign, away past `LEAVING.awayMs`, kicked, afk: lobby.ts:1582, 1599), a pre-start `leave` (:1297), or a
  pre-start Bots-off free (`freeGoneSeats`, :987). A knocked-out person who stays to watch keeps it on, which is the safe direction. A
  seat's `resident` comes only from its socket's session (`accountOf`, lobby-do.ts:620). An existing seat is found by its token
  (refused on another account, lobby.ts:1170) or by the same account, so a resident can't mark a real person's seat. A real person's
  hello still wakes the server (lobby-do.ts:656).
- **Can a resident host while a real person is in the match?** By design, yes while that person is *away*. Their device can't host
  then, and the resident host's scores are now re-checked on the engine server (M1's fix keeps `residentsOnly` false). While the
  person is *connected*, the m1 fix hands hosting back at once. One window remains: the old timer (d-m2 below).
- **Can fair-play data be lost for a real player?** No. m4 only changes which picks make up a real player's `crowd`, `crowdFound` and
  `picks`. Their own rows are still written for every non-practice seat. Phase 2's fair-play searches (recluse.ts:612) are skipped only
  when no real person is in the match. A real person who leaves mid-phase-2 has their result and XP taken as they leave
  (`resultOf` → `rankedFor` at lobby.ts:1410; `takeLeftResults` right after). So the phase 2 that the residents play on afterwards,
  now unvouched (`phase2Unvouched`), doesn't reach them.

## Each fix

| Review item | Fixed? | Test proves it (fails with the fix reverted alone) |
|---|---|---|
| M1 `residentsOnly` ignores `connected` | Yes, complete | judges "residents alone … connected or away": 1 failed with `h.connected &&` back |
| m1 host back to a real person | Yes, one window left (d-m2) | lobby "a real person's device hosts…" and "Eric drops in scoring, returns…": 2 failed without the `else if` |
| m3 Hidden Boss's searches and wake-ups | Phase 2 yes; phase 1 opens a stall (d-m1) | recluse-online, both new "residents alone" tests: 2 failed with the getters back to `io` |
| m4 residents out of a real player's crowd | Yes | judges "residents' picks …": 1 failed with `[everyone, everyoneTally]` for all |
| m5 tests | Yes | 1 v 1: fails without duel-do.ts:220's mark, and without `core.disconnect` on refuse. Squads: fails without squads-do.ts:82's mark, without the lobby's `core.disconnect`, and without the party's |
| `serverRecheck` for residents alone | Yes (two edges, nits a and b) | lobby "the host isn't told…": 1 failed with `serverRechecks` = `!!io.serverEngine` |
| n1 `content-length` first | Yes | residents "the heartbeat …": 1 failed without the check (the header does reach the handler in the test) |
| n2 cache keyed by hash | Yes | (none; nothing to observe from outside) |
| n6 `resident` passed into `connect()` | Yes | Both seat paths set it (new seat :1240; an existing seat sets or clears it, :1187). `markResident` is gone with no callers left (typecheck clean) |

---

## Blockers

None.

## Majors

None.

## Minors

### d-m1. Residents alone with the Hidden Boss in phase 1: with two or more resident devices, his move never comes; the lobby stalls **(probe)**

`lobby.ts:2888` (`if (this.hisOwnMove() && this.phase2Search)`) with the rotation just below it (:2892-2903). The author extended the
m3 gating to phase 1 (the decision's "*(mine)* Phase 1's server move too"). The review asked for phase 2 only.

**Scenario (probe).** A residents-only room fight (`roomFight(2, 2, { engine: true, residents: true })`). Neither device answers his
`bossRequest` (the review's m1: the program can't until design PR 8). At each `bossTimeout`, `phase2Search` is now undefined, so
the code skips `askHis()` and takes `next && next !== hostId`: the next resident gets another 15 s window. With two residents, the
window bounces back and forth forever. Probe: 12 windows (3 minutes), hosts `p2, p1, p2, p1, …`, `bossRequest` sent 7 and 6 times,
his move never played, phase still `boss`. That is exactly the "two silent devices took turns forever" that Eric's Nov 13 option 1
removed. With the engine server on (the same probe, `residents: false`), the server took it at the first timeout. Nothing else
ends the wait, because `LOBBY_LIFE.lobbyAbandonedMinutes` applies only when nobody is connected. The new test passes only because it
seats one resident (`roomFight(1, 3, …)`), so `next` is null and the code reaches `hisQuick()`.

No real person is affected: `residentsOnly` is false whenever one is in the match. The cost is a stuck lobby holding a DO and a
crowd of residents until the program gives up. `engine.md` and the decision also say "phase 1 and 2: his quick move", which isn't
true with two or more residents. (The same rotation exists today for every other boss in a residents-only lobby; PR 5's
boss-final resign is the plan there. The Hidden Boss was the one boss the engine server rescued, and this change removes that
rescue.)

**Fix (one line, either).** (a) In `bossTimeout`, before the rotation:
`if (this.hisOwnMove() && residentsOnly(this.r)) return this.hisQuick();`. That gives what the docs say: his quick move, the match
unvouched. Add a 2-resident case to the new phase-1 test. Or (b) keep phase 1's engine-server move for residents (gate only
`recluse.ts`'s phase-2 `Phase2Lobby`, as the review asked). That costs one search per his move on his own uncapped row. (a) is
simpler and keeps the "no server for residents alone" rule whole.

### d-m2. m1's handback keeps the old timer: a person back late in the window loses hosting to the resident again **(probe)**

`lobby.ts:1193` re-picks the host, but `scoreTimeout` (set once at :3498, `SCORE_TIMEOUT_MS` 15 s) isn't re-armed. Nor is
`bossTimeout`.

**Scenario (probe).** Eric hosts; scoring starts; his phone drops at once, so the resident is asked. He's back at 13 s: `hostId` is
`p2` (Eric), and he's re-asked. At 15 s the original timer fires: `scoreTimeout` → `pickHost("p2")` → the resident (Eric is
excluded), which is asked again. Probe: `hostId` `p2` → `p1` with Eric `connected: true`, and the resident's scores are accepted
(phase `reveal`). A phone that needs more than the 2 s left loses the round to the resident. The damage is small, because the
resident host's scores are re-checked on the engine server while Eric is in the match (M1). In a boss phase, the same timer hands
his move to a resident that can't answer, so the boss waits one more full `bossTimeout` before Eric's device is asked again.

**Fix.** In the m1 branch, when `hostId` changed, re-arm the phase's timer from now: `scoring` without `judges.tasks`:
`setTimer("scoreTimeout", now + SCORE_TIMEOUT_MS)`; `boss` (not `recluse1`): `bossTimeout` as `sendBossRequest`'s callers do.
**Test:** the new m1 test with the return at 13 s instead of 2 s, then `advance(2500)`: `hostId` stays `p2`.

## Nits

- **a.** `resendHostWork` (lobby.ts:1695) sends `scoreRequest` without `serverRecheck`. That's pre-existing, but m1's handback now
  goes through it: Eric's device re-checks its own close calls, and then lobby-do re-checks them on the server too. It's safe
  (double work on a phone). Use `...(this.serverRechecks ? { serverRecheck: true } : {})` there too, as at :3497 and :3507.
- **b.** `serverRecheck` is decided when the request goes out, and lobby-do's re-check when the scores come in. A request sent with
  `serverRecheck: true`, then the last real person resigns before the scores arrive: lobby-do skips the server (now
  `residentsOnly`) and the host skipped its own check, so that round's close calls go unchecked. Only residents are left, and the
  leaver's result was taken as they left. Fine to leave; one line in the decision's "Later" if wanted.
- **c.** m4's consequence, worth one line in the decision: with residents filling most seats, a real player's crowd will often be
  under `FAIRPLAY.signals.minCrowd` (8). Their hard-find signal then uses the solo model (`honestChance`'s `solo` branch,
  core/fairplay.ts:156), not a crowd baseline. That's the intended call, but it means Eric's own matches with residents are judged
  by the solo curve.
- **d.** The party half of the Squads kill-switch test asserts the seat's `connected: false, goneAt` but not that `towerUpkeep` ran
  (the test's comment says it does). Optional: assert one effect of the upkeep, or drop the claim.
- **e.** n2: `residentSessionOf` now hashes the token on every call, cache hits included. That only happens while
  `PAUSE_RESIDENTS` is on, and the cost is negligible. No change needed.

## Changed checks

The delta edits existing tests in four places. **judges** "residents alone": renamed, and the "p3 away" case's assertion changed
from 0 server asks to 1 (as the review asked), plus `bestMove` per case. **lobby** "a real person's device hosts…": the
host after the return changed from `p1` to `p2` (the review's m1). **residents** 1 v 1 and Squads: rewritten through each room's own
door, and stronger. **recluse-online**: `roomFight` gains a `residents` option. New tests: judges m4, two lobby tests, two
recluse-online tests, one heartbeat line. None weakens a guard; none is in `docs/rules/eric.md`; no test was removed.
