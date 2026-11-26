# Review: PR #968, bosses' ultimates in danger (`claude/ult-danger`, head a21b0e49)

The boss lane's one quick review pass (read-only, xhigh). Read: the diff against `origin/main`, the decision note, the audit report,
`prepareTurn`, `unleashed`, `dangerCharge`, Folio's `creaseDue`, Birdie's `afterCrowdMove`, Chandy's ultimate step, the runner's
`judged` and `afterCrowdMove` paths (one boss and several), and the changed tests. One throwaway unit check was run for finding 1
(not committed).

**Verdict:** the rule is sound and solo and online share it (both go through `MatchRunner`: `prepareTurn`, `creaseAsk` and the view's
`rage` and `warned` read the same state, so the protocol needs nothing new). No blocker. Two should-fix edge cases, two nits.

## Should-fix

### 1. Folio's Crease comes a turn late when the crowd is at the line as one of his ultimates ends
`packages/chess/src/bosses/folio.ts:485` (`creaseDue`) against `packages/chess/src/boss-powers.ts:139-140` (`prepareTurn`).

- `creaseDue` answers "no line wanted" while `p.ultAt` is set. But on the turn the Crease (or any ultimate of his) runs out,
  `prepareTurn` clears `ultAt` first, then (new in this PR) `dangerCharge` fills the meter in that same call. Before this PR that
  couldn't matter, since the meter is always empty right after an ultimate. Now it can be full right then.
- **Failing case** (confirmed with a stub battle): Folio's Crease runs to `until` 10 with `dangerSpent` unset (the Crease came below
  the line, or the crowd dipped under it once during the Crease). The crowd's move 10 is judged 0.80. At Folio's move, `creaseDue` is
  false, so no line is asked for. `prepareTurn` for turn 11 then reads `ultAt` cleared, the meter full (`rageOf` 1), `warnAt`
  undefined and only `creaseEnd` among the events: there's no fresh line, so no warning. `creaseDue` is true only at his next move,
  so the warning comes on turn 12 and the Crease on 13. That's three of his turns from the danger move, where every other meter
  boss warns on 11 and fires on 12.
- `ult-danger.test.ts` misses this because it skips windows where an ultimate is under way as the turn begins (`busy`).
- **Fix:** in `creaseDue`, treat an ultimate that ends at `turn` as over: `p.ultAt !== undefined && FOLIO.ultimateRunning(p, turn)`
  instead of `p.ultAt !== undefined`. On that branch, take `rageUsed` as `prepareTurn` does (`ragePoints` of this turn's charge),
  so the two agree. Alternatively, accept the one-turn delay and say so in the decision note.

### 2. Birdie's two-in-a-row count takes Boingo's funhouse move, which is never judged, as a second move at the line
`packages/chess/src/bosses/boingo.ts:394` → `packages/chess/src/runner.ts:2131` → `runner.ts:1648` → `packages/chess/src/bosses/birdie.ts:487`.

- The funhouse plays the crowd's move for it, unscored, and calls `b.afterCrowdMove(m)` with no judged numbers. With several bosses,
  `runner.afterCrowdMove` updates each boss's `judged` only `if (judged && ...)`, so Birdie's hook runs with the previous move's
  number. His `streak` then adds one for a move the judge never scored and nobody picked. That breaks the brief's "never counts the
  boss's own move": the funhouse move is Boingo's choice.
- **Failing case:** a Battle Tower floor with `clown` and `birdie` (they aren't in `BATTLE_TOWER.apart`, and both are in the pool).
  Boingo's funhouse is warned from his ordinary meter. The crowd's next move is its first at 0.72, so Birdie's `danger` is 1. The
  funhouse then plays the crowd's move (a deliberately weak one) and Birdie's `danger` becomes 2: he falls and is armored for the
  rest of the floor after only one judged move at the line. The decision note chose two in a row precisely so that a one-move blip
  can't bring the Fall.
- The other bosses on that floor read the same stale number in `prepareTurn`, so the funhouse's weak move never clears a danger
  either. That's smaller: the meter gain already read it the same way before this PR.
- **Fix (smallest):** pass `judged` through `BIRDIE.afterCrowdMove(b, move, judged)` to `birdieBattle.afterCrowdMove`, and leave the
  count as it is when there's none: `const streak = bd.fell || !judged ? (bd.danger ?? 0) : inDanger(...) ? ... : 0`. Every scored
  move, one boss or several, already passes `judged` (`runner.ts:1359`).

## Nits

### 3. `unleashed` reads the danger line from `BOSS_POWERS`, not from the `s` it is given
`packages/chess/src/bosses/base.ts:633`. `prepareTurn` decides "in danger" with its `s`, but calls `unleashed(next, s)`, which then
uses `inDanger(next.judged)` with the default settings. No shipped path differs: `sideRates` never changes `dangerAt`, and the
server tests change `BOSS_POWERS` itself. But a test or sim that passes a lower `dangerAt` in `s` would fill the meter without ever
setting `dangerSpent`, so ultimates would chain the way the first version's did. Widen `unleashed`'s `s` to include `dangerAt` and
pass it through.

### 4. The funhouse e2e accepts the danger warning only on the phone project and only at the 14th look
`e2e/boss-powers.spec.ts:566` (`const again = phone && warned[13] === true`). This doesn't loosen anything: either branch pins every
turn and angle. But it hangs on the browser judge crossing 0.70 at exactly that look, and only on `phone`. A run where the computer
project's judge crosses the line, or the phone's crosses one look earlier, fails. That's a flake to watch on main's full runs. If it
shows up, keep the crowd level for this spec (it tests angles, not danger) rather than widening the condition.

## Checked, nothing found

- **Solo and online** use one rule: the server's room and the app's solo run the same `MatchRunner` (`preparePowers` → `prepareTurn`,
  `playBoss` → `creaseAsk`, server `lobby.ts:774/2539` reading `runner.creaseAsk()`). The rage bar (`rageOf`) and `warned` come from
  the state `prepareTurn` writes. Chandy's `dodgeMeter` reads 1 once `warnAt` is set, so his bar shows full with the danger warning.
- **`dangerSpent`:** it is set only by `unleashed` (including ultimates fired by the trigger, the test switch or a full meter while the
  crowd is at the line). It is cleared in `prepareTurn` by any crowd move under the line, including during an ultimate (a dip and a
  return is a new danger, as the decision says). Folio's Revision puts `judged` back to the move before, which `prepareTurn` then
  reads consistently. A God King re-pick doesn't re-run `prepareTurn`. Dash's Scramble Rush (half meter) can't be warned on the turn
  the danger warns the Time Scramble (`rushNow` checks `warnAt`); it waits for the meter afterwards, as its own rules say.
- **Folio's `creaseDue`**, apart from finding 1, matches `prepareTurn`: same charge, tick, `lost`, `rageUsed` and speed, and the same
  rates (`BOSS_POWERS` with one boss, `sideRates` with several).
- **Birdie's count**, apart from finding 2: it resets on a move under the line, freezes once he has fallen (once a battle:
  `ultimateOnce`, `bd.fell`), and doesn't see a move Revision crosses out (the several-boss loop breaks before him). The rewritten
  early return clears only a stale `warn` that `wearOff` would clear as the next turn begins.
- **Unchanged bosses:** `pig` (Wrangler) and `recluse` both have `BossRules.meter`, so `prepareTurn`'s fill skips them. Neither file
  is in the diff, and neither reads `inDanger`. The `dangerSpent` that `unleashed` may now set on them is never read.
- **Changed tests**, as listed in the PR body: grex's rates and the four server files move `dangerAt` out of reach with their
  assertions unchanged. Sawyer's 0.9 → `dangerAt − 0.01` still asserts the meter refilling after the saw (just under the line). The
  added tests check the rule. None was loosened.
- **FAQ** (rage meter, Chandy's Dodge, Birdie's Fall) and `docs/areas/bosses.md` match the code, apart from finding 1's extra turn.
