# Delta review 2: PR #601's fix round 2 (05ed5b2..4d7c8e1 on claude/fable-b1)

Read-only, xhigh. Read: CLAUDE.md, `delta.md`, `.review-fixes.md` "Round 2", `git diff 05ed5b2 origin/claude/fable-b1`.
Ran: `npx vitest run packages/server` at 4d7c8e1: **68 files, 1016 / 1016 of the PR's tests pass**; delta.md's proof
test `zz-delta-b1.test.ts` now **fails** (its >50% claim no longer holds), as it should. Measurements: `zz-delta2-b1.test.ts`
on this branch (copy into `packages/server/test/`, prints the table), the PR's own `drawJudges` at `JUDGES`, 20,000
draws per row, one board, no load.

**Verdict: blocker 1 is closed for two accounts. One major (the same pairing at four accounts), one minor, one note.
Refills, replacements and referees can't stall or pick one owner.**

## Blocker 1: closed (for two accounts)

| Lobby | delta.md (round 1) | round 2 |
|---|---|---|
| 98 phones; 2 atk "computer" 3M | 66.8% | **1.6%** |
| review's lobby (20c 2M + 78p); 2 atk | 1.7% | 0.7% |
| 3 computers + 95 phones; 2 atk | 20.2% | 3.3% |
| 62 phones; 2 atk | 75.9% | 4.3% (PR says 2.9%; seed noise, under the 5% aim either way) |
| 98 phones; 2 atk at phone speed claiming "computer" | 1.9% | 0.02% (PR's figure) |
| 98 computers 2M; atk claim "phone" 3M | 4.4% | 0.1% (PR's figure) |
| all one class: 98 phones; 2 atk "phone" 3M | | 1.7% |
| two similar classes: 50c + 48p / 48c + 50p (median on either side); 2 atk | | 0.7% / 0.7% |

## Major

### 1. Class pairing still lets the attacker pick the second judge once they bring four accounts
`judges.ts:167` (`new Set(same.map(ownerOf)).size >= pairClassMin`), `settings.ts:2423` (`pairClassMin: 3`). The
threshold counts *owners of the claimed class*, and the attacker supplies them. With 4 accounts claiming "computer" in a
phone lobby, after the first is drawn the class has 3 other owners, all theirs, so the second comes only from them:
P(both) = P(first is theirs). There's a cliff at exactly `pairClassMin + 1` accounts.

- **Failing case (ran it).** 96 phones at 300k + 4 accounts claiming "computer" at 3M: both judges theirs on **29.3%**
  of boards (class ignored, same caps: 7.4%). 6 accounts: 40.3% (13.4%); 10: 52.1% (23.1%). 3 accounts: 5.3% (5.2%),
  so the cliff is between 3 and 4.
- **Why major, not blocker.** Four accounts in one public lobby is much harder than two (the queue picks the lobby), and
  main is worse still (speedWeight 3, no cap). But it's the same shape delta.md blocked on, the PR's doc and settings
  comment say "a claimed class never decides who the second is", which isn't true at 4, and agreeing judges are
  accepted unchecked.
- **Fix I'd make.** Make the threshold relative: pair by class only when the class's other owners are at least
  `max(pairClassMin, ~10% of the pool's owners)`. Measured with 10 in a 100-device lobby: 4 atk 7.4%, 6 atk 13.4%,
  10 atk 23.1% (= class ignored). Cost: honest lobbies with 5-10 real computers among 90 phones get mixed pairs again
  (25-28%, vs 0% now; 11+ computers: 0%). That's the trade to decide; or pay it only on lobbies under the share. Either
  way, the decision note should state the worst case by number of accounts, not only two.

## Minor

### 2. The small-lobby leftover has no number
`docs/decisions/2026-11-10-judge-pairing.md:23` says a ~20-device lobby "still gives two claimed accounts a bigger
share". Measured (2 atk "computer" 3M among phones): 4 devices 98.6%, 6: 57.5%, 8: 43.7%, 10: 35.6%, 20: **17.9%**.
The 3× median cap is 9× a phone's weight, which dominates a small pool; the median itself rises when the attacker is a
big share of it (2 + 2: median 1.65M, cap 3M). All of these are lower than the PR before fixes and far lower than main
(no cap), and class pairing isn't involved (threshold never met), so not a regression. Put the 20-device number in the
note and the ROADMAP line, and say which lobbies are that small with judging on (private lobbies, where everyone may be
one person anyway; small boss raids?).

## Note (not this PR)
`lobby.ts:2635-2649`: if `deepOnDevices` is ever turned on, two accounts claiming "computer" at a fast speed make
`deepMode()` true and `judgePool()` = only capable devices = the two of them: 100% in a phone lobby. Off today
(`settings.ts:2438`, `deepOnDevices: false`), so nothing to do now; worth a line next to that setting.

## Checked, fine
- **Median cap and honest play.** Real computers (2M) among phones weigh as 3× a phone (9× weight). Computer judges
  first: 3c + 97p 19.8%, 5c 31.5%, 10c 48.0%, 20c 66.6% (uncapped w2 would be about 99% at 20c). So phones judge more
  often in mixed lobbies; a round is then at worst as slow as an all-phone lobby, which already has to fit. Mixed pairs:
  0% from 5 computers up; 17.9% with exactly 3 computers (2 others < 3: drawn from everyone, as with kind ignored).
  Nothing is slower than the all-phone case; I'd accept it.
- **`kind` on refills, replacements, referees: no stall.** `from` falls back to the whole `pool` whenever the class is
  empty or under the threshold (`judges.ts:167`), so `drawJudges` returns exactly as many judges as without `kind`.
  `kindOf(undefined)` (no remaining judge) and a gone human give `undefined`, so `paired` starts false and the draw is
  the old one. Referee `kind` only when the two share one; two gone humans give `undefined`, an unrestricted draw.
- **One owner.** Exclusion is by owner of the excluded ids found in the pool passed (`judges.ts`, `owners`); refill
  excludes the planned judges, replace and referee exclude `t.tried` (which holds both judges). The capable-only pool in
  `replaceJudge` / `dispute` could miss an excluded judge's owner if it's not capable, but one seat per account
  (`lobby.ts:2617`) makes owner = seat, so it can't happen.
- **Squads `sameParty`** and the `judges.test.ts` comment: as asked.
