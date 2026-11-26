# Review: Chandy's Dodge from your mate (`claude/chandy-mate-dodge`, head e5971764)

The boss lane's quick review pass, read-only. I read the PR body, `docs/decisions/2026-11-26-chandy-mate-dodge.md`, and
`git diff origin/main...origin/claude/chandy-mate-dodge`. I traced the runner (`afterCrowdMove`, `stageComplete`, `finishBossBattle`,
`bossToMove`, `bossKillDue`, `preparePowers`, `crowdGameEnd`), the server (`nextRound`, `afterReveal`, `bosses/chandy.ts`,
`bossViewSent`), solo (`nextRound`, `afterBossRound`, `dodgeTurn`/`armDodge`/`dodgeStep`/`dodgeVote`, `endOnHide`, `moment`/`momentNow`,
`simulateRest`) and every script that drives a boss battle. I ran no tests: none of the findings needs one to confirm it.

**No blockers.** The rules, the result and the timing hold. There is one should-fix, in the FAQ's copy, plus four nits.

## Findings

### 1. should-fix: the FAQ still says Chandy's Dodge comes in danger

`packages/app/src/faq/content.ts:1055`, the general **"A boss in danger"** entry, still ends: "... Chandy's Dodge comes the same way,
and Birdie's Fall once you're there ...". This PR removes his danger path (`CHANDY.ultimate`: `dodgeMeter < 1 && !testSwitch` →
no warning; `ult-danger.test.ts` lists him in `NOT_HERE`; the inverted `chandy.test.ts` case expects no warning and no Dodge at 0.95).
The PR also rewrote the FAQ's own Chandy entry, so the two FAQ entries now contradict each other.

- Failing case: you play Chandy with 2 upgrades and your chances at 70% or more. The FAQ promises his Dodge within two of his turns,
  and it never comes.
- CLAUDE.md requires the FAQ to match the code exactly.
- Fix: drop "Chandy's Dodge comes the same way," from that sentence, or say he's the exception (his meter or your checkmate only).

### 2. nit: the `dangerAt` setting's comment is stale

`packages/core/src/settings.ts:1463`: the `dangerAt` doc comment still says "... and Chandy's Dodge is warned as his rifle's meter
would". This is no longer true. Drop the clause, or note that he is left out since Nov 26.

### 3. nit: a runner comment still names Chandy for `ultimateNow`

`packages/chess/src/runner.ts:2601`: the `focusNow` doc still says "(BossRules.ultimateNow: Chandy's Dodge, read from him as at his
own turn change)". No boss uses `ultimateNow` now. The PR updated the other `ultimateNow` comments (`prepareSide`, `base.ts`,
`boss-powers.ts`) but missed this one.

### 4. nit: `raid-scoring-trace.ts` never plays a Dodge, so a mate now stalls it

`packages/sim/scripts/raid-scoring-trace.ts:72-94` has no `dodgeDue` branch. Before this PR that was harmless: an unplayed meter Dodge
never blocked anything, and a mate ended the battle.

- Failing case: run `npx tsx packages/sim/scripts/raid-scoring-trace.ts chandy …` and let the crowd mate him. `mateHeld` holds the
  battle, so `stageComplete()` stays false and `bossToMove()` is false (the board's game is over). The loop falls through to
  `runner.deal()` and `runner.score()` on the mated board, and the battle never ends cleanly.
- The other drivers already handle it: `boss-sim.ts`, `tower-sim.ts`, `ult-danger.ts`, solo's `simulateRest` and the server.
- Fix: add `if (runner.dodgeDue()) { while (runner.dodgeDue()) runner.finishDodgeRound({}); continue; }` before `deal()`.
- It's a dev script only, so this is a nit.

### 5. nit: the e2e opening check got a little looser for the meter's Dodge

`e2e/chandy.spec.ts:94`: `dodgeOpening` now accepts `cd-p-mate` first for every caller, including the meter-path test (line 340).
Before, a mate opening sampled at the start of a meter Dodge failed the order check (`indexOf` was -1); now it passes. The unit test
covers it (`chandy-wired.test.ts`: a meter Dodge at -10 ms is `scope`), so this is a nit. To close it, pass the order in per caller,
or add `expect(s.dodge[0]).not.toBe("cd-p-mate")` to the meter test.

(Housekeeping for the merge: `.pr-body.md` and `.done` are in the branch's diff and aren't on `main`.)

## The five questions

1. **The result is always right.** No findings.
   - **Survived:** after three rounds `dodgeOver`, so `mateHeld` is false. `stageComplete()` is then true through `finalGameOver()`,
     and `finishBossBattle` returns `gameWinner()`: checkmate, so `crowd`. The `timeout` term needs `!finalGameOver()`, so it can't
     turn this into a loss on time. The board never changes during the Dodge.
   - **One hit:** the mate still stands.
   - **Two hits:** `dodgeWon` makes it `boss` before the board is read.
   - **Stalemate:** `boardEnd` isn't `"checkmate"`, so there's no Dodge and the result is a draw.
   - **The God King's strike:** `bossKillDue()` needs `!finalGameOver()`, so it can't come in solo's `afterBossRound` or the server's
     `afterReveal`.
   - **The God King's Last Stand:** it takes the move back before `playOnBoard`, so a mate it takes back never reaches
     `afterCrowdMove`.
   - **The admins' trigger:** `triggerUltimate` refuses once `finalGameOver()`.
   - **Once a battle:** with `ults ≥ dodgeMax()`, a mate is a mate. If his meter warned first and you mate him, one Dodge comes from
     the mate (`warnAt` kept, `ultAt` set, `unleashed` counts it).
   - The admin's 🏆 (`bossForceWin`) still wins after a lost Dodge. That's the same as the meter path today, and test-only.
2. **`mateHeld` / `stageComplete`.** No findings.
   - **The hold:** `stageComplete` is gated first on `!sideBosses().some(mateHeld)`, so the move cap, `bossOutOfTime`, other bosses'
     wins and the force switches all wait for the Dodge.
   - **Nothing else steps in:** `bossToMove()` is false on a finished board, so the server and solo both reach `dodgeDue()`. With
     `d.mate` it is true despite `finalGameOver()`. `crowdGameEnd` is null in a boss battle, and `preparePowers` and `deal` aren't
     reached.
   - **Clocks and AFK:** nobody's clock runs during the Dodge, and AFK is only counted in `score()`.
   - **A floor of several:** `mateDodge` refuses (`bosses.length > 1`), and that floor's 8-order test covers it.
   - **A solo rejoin:** in the opening, the kept `ms` is 0 (`momentNow` clamps), so it goes on from the Dodge's own start, as decided.
     During the win beat, `dodgeOver` makes `stageComplete` true, and the result is the crowd's.
   - **Page closed:** `endOnHide` in the win beat decides it as the crowd's (`dodgeStep` → `nextRound`).
3. **Online vs solo timing.** No findings.
   - **Start:** both start at `now + dodgeLeadMs(d)`. The server arms its first step from `l.at` (the first teleport time), so every
     window keeps its time from `at`.
   - **What's sent:** `dodgeSeen` with a negative elapsed time shows nothing and keeps `mate`.
   - **Votes:** a vote in the opening is refused by the `t < voteAt - 300` check, both online and in solo.
   - **End:** `dodgeEndAt` includes the win beat only when the Dodge is survived (`results.length >= rounds.length`, hits under 2),
     and the server's last timer is `l.at + dodgeEndAt(d)`.
   - **Beats:** adding `win.at` to `beats` is harmless for a meter Dodge. It's after round 3's close, whose update keeps the time
     anyway: `REVEAL_LEAD_MS` is 100 ms, far less than the locked, travel and hold time that follow the close.
   - **Who decides:** the server's runner decides the result.
4. **The meter path is unchanged.** No findings.
   - `ultimate()` differs from main only in the removed `mateOpen`/`inDanger` terms, which is the intended rule change.
   - `afterCrowdMove` runs exactly as before when there's no mate. `chandyOf(p)` is `p.chandy` when it's set, and a missing state
     still returns before the rest.
   - `dodgeDue` for `!d.mate` is the old expression.
   - The generic danger charge never applied to him (`rules.meter`).
   - On a Battle Tower floor: a mate is a mate on a floor of several, his meter still brings his Dodge there, and alone on a floor
     your mate brings it.
5. **Changed and removed tests.** The tests only moved what the rule had to move, apart from the small e2e loosening in nit 5.
   - The `mateOpen` twin, the last-chance tests and Ginger's freeze-stops-the-mate case are removed with their rule.
   - The danger test is inverted, and its new version is strict (no warning, no Dodge, rage 0 for six moves).
   - The dropped "no mate in one" check only ruled out the last chance.
   - The stubbed `ultimateNow` line-up test is kept, so the runner's generic path is still covered.
