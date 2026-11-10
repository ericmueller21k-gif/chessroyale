# Delta review: PR #601's fix round (459713f..05ed5b2 on claude/fable-b1)

Read-only, xhigh. Read: CLAUDE.md, `review.md`, `.review-fixes.md`, `git diff 8651755 origin/claude/fable-b1`.
Ran: `npx vitest run packages/server` at 05ed5b2: **68 files, 1015 / 1015 pass**. My proof test:
`zz-delta-b1.test.ts` on this branch (copy into `packages/server/test/`; passes, showing the blocker). Measurements
below call the PR's own `drawJudges` at `JUDGES` (weight 2, cap 3M), 20,000 draws per row, one board, no load.

**Verdict: one blocker (class pairing trusts a claimed class), two minors, two nits. Fixes 2, 3, 5 and the test change
are right.**

## Blocker

### 1. Class pairing trusts the class a device claims: two accounts that claim the rare class get both judges
`judges.ts:153-154` (`same = pool.filter((d) => d.kind === kind)`), fed by `lobby.ts:2620` (`kind: h.device`).
`h.device` is the hello's `device` field, the device's own word (`lobby.ts:817`; it even defaults to `"computer"` when
omitted). The app sets it from `matchMedia("(pointer: coarse)")` (`net.ts:496`), so a desktop tab or a crafted client
can say anything.

When the first judge is an attacker's account claiming a class nobody else in the lobby has, the second judge is drawn
**only from that class**, which is the attacker's second account. So the chance is P(first is either attacker), not
P(first) × P(second).

- **Failing case (ran it, `zz-delta-b1.test.ts`).** 98 honest phones at 300k plus two attacker accounts that say
  `device: "computer"` and a speed of 3M: both judges are the attacker's on **66.8%** of boards.

| Lobby (two attacker accounts) | fix round (w2, 3M, pairing) | w2, 3M, kind ignored | PR before fixes (w1, 5M) |
|---|---|---|---|
| review's lobby: 20 computers 2M, 78 phones 300k; atk "computer" 3M | 1.7% | 1.7% | about 1% |
| 98 phones; atk "computer" 3M | **66.8%** | 33.3% | 4.2% |
| 98 phones; atk "computer" at a phone's 300k (no speed lie at all) | **1.9%** | 0.0% | 0.0% |
| 3 computers 2M + 95 phones; atk "computer" 3M | **20.2%** | 14.7% | |
| 62 phones (Classic size); atk "computer" 3M | **75.9%** | 46.7% | |
| 98 computers 2M; atk "phone" 3M | 4.4% | 0.1% | |

- **Why it's a blocker.** Two judges that agree are accepted with no check at all (`spotCheckShare` covers only lone
  answers, `settings.ts:2392-2395`), so these boards are the attacker's to score. All-phone lobbies are the normal case
  for a phone-first game. The fix round's own number (1.9%) holds only for the review's lobby, which has 20 real
  computers; the PR is the device-trust PR, and in a lobby of phones it moves the worst case from 4.2% (the PR before
  this round) to 67%. Even with no speed lie, the class claim alone gives a 100-fold rise (0.02% → 1.9%).
- Two parts, separable: the class pairing doubles the share (33% → 67%); the weight-2 / 3M change alone takes it from
  4% to 33% in a phone lobby, because 3M is ten times a phone, so 100 times the weight. The 3M cap is "a real fast
  desktop", which is right in a lobby of desktops and far too much in a lobby of phones.
- **Fix I'd make (both small, in `drawJudges` / `judgeDevices`).**
  (a) Pair by class only when the first's class has at least, say, 3 other owners left in the pool; otherwise draw the
  second from everyone. A claimed class can then never force who the second judge is. (Measured: in the 98-phone lobby
  this alone returns it to the "kind ignored" column.)
  (b) Make the speed cap relative to the lobby, e.g. weight on `min(nps, maxNps, 4 × the median nps of the
  first's class or of the pool)`. Measured with (a) and a 1.2M cap (4 × a phone) in the 98-phone lobby: **5.0%** (vs
  66.8%). Check the review's lobby again with whichever median is chosen, so real computers keep pairing together.
  Then run the PR's "judge pairs at the review's lobby" test plus one all-phone row, and put the all-phone worst case in
  `2026-11-10-judge-pairing.md` (it currently gives only the review's lobby).

## Minor

### 2. A refilled judge isn't paired by class
`lobby.ts` `startJudging` (`judges.length < perJob` → `drawJudges(..., new Set(judges))`). When one planned judge is
gone, the replacement is drawn with `out` empty, so `kind` is unset and it comes from the whole pool, not the remaining
judge's class: the mixed pair (one answer used alone) still happens on that path. Same for the late and referee paths.
Small; the fix is to pass the remaining judge's class into `drawJudges` (an optional `kind` argument), once blocker 1's
threshold is in.

### 3. A Squads reward job can be settled by the beneficiary's own party alone, unchecked (not new)
`squads-lobby.ts:1676, 1707` (token refunds and brilliants: `last` = the token's own squad) with `pickDevices`'s new
checker (`:2147`). When the token owner's party has the only free devices, both answers come from that party; agreeing
settles `"one"` and decides the refund (`:1746`) or brilliant (`:1758`), with no server check. **This is not a
regression**: before the fix round it was one device of that party alone, and on main two of it, `"agreed"`. The fix
round is strictly better (a disagreement now goes to the server or an outside referee). Worth a ROADMAP line: a `"one"`
answer on a job that pays something gets a server spot check, as the main lobby's lone answers do.

## Nit

- `judges.test.ts:216` comment says a lone computer "would seldom judge". It still judges first most of the time
  (weight 100 vs 9 + 9); I ran the old line at 05ed5b2 and it fails at `nextTurn` ("expected 'final' to be 'results'":
  the match ran out of rounds before p1's second strike), not on any claim. So the change is fine and **keeps the test's
  claim** (every assertion is unchanged: p1's pick keeps its true loss, two strikes, benched, disagreed = server
  verdicts, no strikes for p2 and p3). Only the comment's reason is off: say "so p1 is paired with judges that answer as
  fast, and the match lasts the rounds the test needs".
- `squads-lobby.ts:2152` `sameParty`: two ids whose humans are both gone compare `undefined === undefined` → true.
  Harmless today (a gone device isn't `deviceUp`), but `!!pa && pa === pb` says what it means.

## Checked, fine
- **No judge / stuck pair.** `drawJudges` falls back to the whole pool when the first's class is empty (`if
  (same.length)`), so it returns as many judges as before in every case: one device → one, all excluded → none (the
  host path, as before), a class of one → a judge of the other class. `kind` undefined for everyone is one class.
  `judging()` still needs two devices. Nothing new can stall.
- **Fix 2, Squads' cache.** Nothing writes `TOP_CACHE`; `settle`'s `follows` path reads it (always empty now) or its
  twin. The server verdict settles its own job only. The flipped test asserts no sharing.
- **Fix 3, the party checker.** Added only when exactly one device was picked, `n >= 2` and `exclude` is empty, so never
  for a referee (`pickDevices(lm, 1, job.devices)` passes both devices, whose parties are filtered out: a referee is
  never of either's party). It obeys the in-flight cap (`ranked` is filtered first). Two of one party agreeing is
  `"one"` (same trust as one device alone; no cache to reach another lobby); disagreeing goes to the server, which
  strikes the further one, or an outside referee, or `"fallback"`. A party could force server calls by disagreeing with
  itself, but any two outside players already can. `squads-v2-lobby.test.ts:78` back to `perJob` matches.
- **Fix 5, `atTheDoor`.** The app's only `scores` send (`net.ts:1186`) fills every slot of `new Array(jobs.length)`
  with an object before sending (a throw skips the send entirely), so no `null` hole reaches the door; `boards: []`
  passes. Other messages pass on `t` alone, as before.
- **Fix 1's weight and cap** at the review's lobby: my numbers match `.review-fixes.md` (mixed 0%, both-attacker 1.7%
  to 1.9%).
- **Tests.** `npx vitest run packages/server`: 1015 / 1015.
