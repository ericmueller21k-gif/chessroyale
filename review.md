# Review: PR #601 (device trust), branch claude/fable-b1 at 8651755

Independent, read-only, full lane. Read: CLAUDE.md, the PR diff, the outside review (part 1 findings 1 and 5;
part 2 rules items 3 and 6). Ran: `npx vitest run packages/server` on the PR branch: **1010 / 1010 pass**. The outside
review's two proof tests, run against the PR: many-seats now gives one seat (`p1` three times); lying-host still wins the
raid (finding 2, out of scope as the PR says). My proof tests: `zz-review-b1.test.ts` on this branch (copy into
`packages/server/test/`; 3 tests, all pass, showing findings 1 to 3). CI's full e2e was still running when this was
written: the director should read it, since one-seat-per-account would merge any e2e "two players" that share a browser
context (I found none for sure, but didn't check every spec).

**Verdict: no blocker. Two majors worth fixing before merge (1 and 2), or merge with them as the next PR.**

## Major

### 1. `speedWeight: 1` puts about half of all jobs on a computer + phone pair, and those settle on one answer
`packages/core/src/settings.ts:2407` (`speedWeight: 1`), with `lobby.ts:2880-2900` (the lone-answer path).

- **Failing case (ran it, `zz-review-b1.test.ts`, third test).** 20 computers at 2M and 80 phones at 300k, 4,000 draws:
  mixed pairs **2.8% with the cube, 48.0% linear**; phone + phone pairs **0.03% to 13.7%**.
- **Why it matters.** In a mixed pair the computer answers first, the lobby waits `max(graceMs 150, 0.25 × its time)`,
  and the phone (about 6 to 7 times slower) is late, so the computer's answer is used alone (`how: "single"`, a 25% spot
  check). So the change that stops one person's two claims also turns "two judges agree" into "one judge, sometimes
  checked" for roughly half the jobs in a typical lobby. That's the check the PR is shoring up. Phone pairs also slow
  rounds (Eric's priority 1: smooth play). Spot checks rise about 15 times, on the shared daily engine budget.
- **Now that one seat per account is in, the cube is far less dangerous.** For a two-account attacker at the 5M cap
  against the lobby above, the chance both judges are theirs per board: cube 13%, square 4.1%, linear 0.5%, **cube with a
  3M cap 1.8%**.
- **Fix I'd make.** Keep `maxNps`. Pick the weight by the table above rather than linear. My suggestion is `speedWeight: 2`
  with `maxNps: 3_000_000`, which is close to a real fast desktop. Better and still small: draw the second judge from
  devices of the **same class** as the first (computer with computer), so a pair finishes together. Either way, run one
  judges sim at one setting to measure the single-answer share before and after (the PR doesn't measure it, and the
  decision note doesn't mention the trade-off).

### 2. Squads' shared cache still takes answers that devices chose: the server's verdict only scores the devices' moves
`squads-lobby.ts:2288` (`serverTop` with `verdictMovesOf([a.top, b.top])`), `:2325` (`cacheTop(job.fen, verdict)`).

- **Failing case (ran it, first test).** Two solo players (two parties, so the new party rule doesn't apply) each send a
  top list of 4 different junk moves. They disagree, so the server is asked, but **only to score those 8 moves**: none of
  the engine's real top moves is in the request. The honest verdict over junk goes in `TOP_CACHE`. A fresh lobby on the
  same instance then plays that position from the cache (`how: "cached"`), and every move in it is junk.
- **Why it matters.** The PR says "Squads' shared cache holds only the engine server's answers" (true), and the docs
  present that as closing the cache attack (finding 5, third bullet). It takes two free accounts in two parties instead
  of two devices that agree, which is no harder. The main lobby's re-check has the same shape (outside review finding 3:
  the deep re-check confirms a forged list).
- **Fix I'd make (any one).** (a) Ask the server for its own top moves, not a score of the devices' list (a `topMoves`
  call on the container, or add `fallbackTop`'s quick candidates to `moves`). (b) Simplest: don't cache verdicts at all
  until (a) exists. The cache is a cost saving, and Eric's priority 1 comes first. Then flip the test in
  `device-trust.test.ts:231-240`, which currently asserts that this verdict *is* shared.

## Minor

### 3. Squads: a party with no outside devices now gets one device per bot job, alone (no cross-check, no server)
`squads-lobby.ts:2140-2145`. **Ran it (second test):** a party of 4 computers and bots: every job has `devices.length === 1`.
Before, two of the party's devices compared answers, and a disagreement (a buggy or overloaded device) went to the
engine server. Agreement is no longer cached, so the party rule adds no trust within the party's own lobby (two party
devices agreeing equal one), but it does lose the honest-error check. **Fix:** let a second device of the same party
answer as a *checker*: its disagreement still goes to the server, its agreement settles the job as `"one"`-level trust
(never shared). Or say in the decision note that this is accepted. The `squads-v2-lobby.test.ts:78` change (2 → 1) is
this effect.

### 4. A host can still flatten any round it likes, and nothing counts it
`lobby.ts:2427-2429`. A host that sends a board failing `hostBoardOk` (say `expectedAfter: {}`) makes every pick on it
count the same. That's better than before (an omitted pick no longer "counts as the best"), but a host who is behind can
erase every round's losses for everyone, and the only trace is a `console.log`. **Fix:** count failed host boards per
host; after 1 or 2, `pickHost` another device (or strike it in `jr.devices`) and note it for fair play.

### 5. The DO's door accepts `boards: [null]`, which throws mid-handler
`lobby-do.ts:470-471` (read, not run). The door checks that `boards` is an array of at most 64, not that each element is
an object. With the engine up, `recheckOnServer` reads `b.boardId` of `null` and rejects. Without it, `applyScores` sets
`runner.kingCallers` and then throws in `new Map(boards.map((b) => [b.boardId, b]))`. The handler throws before
`persist`, so it's a no-op, and only the host can send it (no different from silence), but it's an uncaught error in
the logs on demand. **Fix:** at the door, `msg.boards.every((b) => b && typeof b === "object")`.

### 6. The PR body says more than the code does in two places
- "A device's answer now counts only when something checks it." The lone-answer path is unchanged: a judge that answers
  instantly is used alone whenever its partner takes over 150 ms, with a 25% spot check and blame only after the fact
  (bounded by `strikes: 2` per match). Finding 1 above makes this path common. Say "two judges are never one account",
  not "always checked".
- "Host scores are checked the way a judge's are." They're checked for shape. A judge's are also checked by a second
  judge agreeing. The values a lone host sends are still its word (finding 5's first bullet, rightly on the ROADMAP).
  `docs/areas/engine.md` has the same wording.

### 7. Squads: a guest who signs in mid-lobby is now refused their seat (staging only)
`squads-lobby.ts:664`. The removed `this.r.accounts[existing.id] = opts.userId` used to move the seat to the new account.
Now the old token plus the new account gives `SQUADS_OTHER_ACCOUNT`, as the main lobby already did. Production refuses
guests at hello (`squads-do.ts:335`), so this only affects servers where sign-in isn't required. Fine to keep, but worth
one line in the decision note.

### 8. A second arrival doesn't use up a matchmaker reservation
`lobby-do.ts:509` shifts a reservation only when `humans.length` grows. An account that queued twice (two tabs) holds
two reservations, and one now never fills, so a bot takes it at fill time. This only matters if the matchmaker reserves
per ticket and not per account. A note, not a fix.

## Checked, fine
- **Reconnects and tabs.** A reload with the token, a second tab with no token, a second device, and a stale token from an
  older lobby (now matched by account, not `MATCH_ENDED`) all land in the same seat. Both sockets stay attached;
  `webSocketClose` leaves the player connected while another socket remains. Squads' `known` / restore fix
  (`squads-do.ts:352`) keeps a refused hello from marking the real seat gone. A player who resigned or was freed has
  left `humans`, so the account match can't revive them (`LEFT_MATCH` / `freed` paths unchanged). Seats with no account
  are still one per hello.
- **Parties.** The same member's pass from a second device gets their own seat back, unchanged; another account with
  that pass is refused. Party seats and `members` aren't touched on takeover.
- **Judges.** `drawJudges` by owner: the owner is the account, or the seat id when there is none, so with one seat per
  account the pool is never smaller than before. `exclude` drops the excluded seats' owners (the referee and late
  paths). Nothing can be left with no judge that couldn't before. The weights stay random (no "always the same one").
- **`hostBoardOk` for an honest host** (traced against `net.ts:1121-1186`). Every human pick, bot pick, escape and offer
  is scored (`missing`). The best move comes from `judgeCandidates`, which respects `allowed` and `barred`. Re-checked
  values are clamped to 0..1 (`applyRecheck`). Planned bot picks are legal after `cleanBotPlan`. Promotions match
  (`e7e8q` on both sides). Chess960 uses `legalMoves960` on both sides (the same function as the judges' check, so no
  new mismatch). A board with no legal move gets no job. `botPicks: {}` passes when there are no bots.
- **`cleanBotPlan`** uses the same first group, the same `allowed` / `barred` and the same bots as `planJudges`, so a
  real plan passes whole. The plan-mismatch strike still works for legal-but-wrong picks.
- **The door.** The app sends only JSON objects with `t` (`net.ts:540`). The longest legitimate `bossMove.move` is far
  under 128. `scores` with up to 64 boards covers Classic's 8.
- **Squads' cache.** Agreement and `"one"` answers no longer reach `TOP_CACHE` (only `serverAnswered` writes it). The
  `follows` path reads the cache or its own twin only.
- **Proof tests.** Many-seats is closed (main lobby and Squads). Host-omits-its-pick is closed (that board is flattened).
  The lying-host raid (finding 2) is open, as the PR says.
