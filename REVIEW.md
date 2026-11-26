# Review: PR #972, the pass guard's wait cap (`BOSS_POWERS.ultWaitMax`), head 946bb883

Boss lane, one quick read-only pass. I read the diff, the decision, `carrotBattle.due/apply`, `castAnswer`, `waterAnswer`,
`gardenerBattle.due/roll/ask/any/apply`, `prepareTurn` (where `warnAt` is set), the runner's several-boss turn steps
(`prepareSide`, `sideSteps`, `asBoss`/`setFocus`), the server's boss request (`waterAsk`, `pass: true`, the `carrots` and
`water` answers) and the app's host answer (`net.ts`). Tests weren't run (no `node_modules` here; CI runs them).

## Checked and right

- **The count from the warning (one boss).** `warnAt` is `turnOf(boss) = crowdMoves + 1` as the crowd turn begins, so the
  first try is at `crowdMoves === warnAt` (difference 0). The guard holds at differences 0, 1 and 2 and the cast comes at 3:
  three holds, then it comes. That matches "at most 3 of his turns" in a one-boss battle, and the new pass-guard test
  (warnAt 1, tries at crowdMoves 1 to 4) checks exactly that.
- **In check it still waits.** `forced` is only read inside `apply`, after `due`, and `due` still needs `passTurn(...) !== null`.
  So a check, or a crowd left with no move, still keeps the cast back, as the FAQ says.
- **Online and solo agree on the cast.** The server enforces the cap itself (`applyCarrots(PASS_WAIT)` ignores the answer once
  `forced`), so a stale or misbehaving host answering PASS_WAIT after the cap can't hold it back. Solo goes through the same
  `apply`. A timeout (`playBoss("")`) casts as before.
- **Online and solo agree on the watering.** Solo passes `gardenerBattle.any(b)` into `waterAnswer`. Online the server sends
  `waterAny` from the same `any()` on the same turn as the roll. `waterAny` was already in the protocol and already honored by
  `net.ts`, so older apps follow the cap too.
- **Alfil's fusion is untouched.** `alfil.ts` isn't in the diff and doesn't read `ultWaitMax`.
- **The tests fail without the fix.** In the pass-guard test, try 4's `applyCarrots(PASS_WAIT)` returns null without the fix,
  so `patch!.squares` throws. In the gardener test, `at(8, 5)` returns false without the fix. (Each also fails earlier, on the
  `ultWaitMax` read being undefined, but the checks that matter are those two.)
- **The FAQ wording matches the code** in a one-boss battle: `n(3, "of their turns", "of their turns")` gives "3 of their
  turns".

## Findings

### 1. On a Battle Tower floor of several bosses the cap counts crowd moves, not his turns: should-fix

`packages/chess/src/bosses/hopper.ts:654`, `packages/chess/src/bosses/gardener.ts:633`

`crowdMoves` is shared by every boss on a side: it's not in `BOSS_OWN_FIELDS`, and `match.ts:512` bumps it once per crowd
move. On a floor of `n` bosses, though, his turn only comes every `n` crowd moves (`prepareSide`: `nextUp = (moved + 1) % n`;
`due` needs `boss.id === "hopper"` / `"gardener"` in focus). His warning is set at his own turn change (`mine(i)`), so his
first try is still at difference 0, but his next tries come at differences `n`, `2n` and so on.

- Floor of 3 (Chub & Chirp or Puddles with two others): the guard holds at 0, and at his next turn (difference 3) the cast
  or watering is forced. That's **1** hold, not 3.
- Floor of 2: it holds at 0 and 2 and is forced at 4. That's **2** holds.

Both bosses can be dealt on tower floors of several (`BATTLE_TOWER.addsPieces` names `gardener`, and the hopper code says
"Solo, online and in the Battle Tower"). So the FAQ's "at most 3 of their turns", the settings comment and the decision are
all wrong there, and on a floor of 3 he gives up material after a single wait.

Suggested fix, about as small as the current one: count his guard waits rather than crowd moves. Bump a counter where the
wait is already recorded (`passWait` in `carrotBattle.apply`'s PASS_WAIT branch; `wait` in `gardenerBattle.apply`'s
`!checked` branch), and force once the counter reaches `ultWaitMax`. That also makes in-check turns not count as waits (see
2), and covers the admins' trigger (see 3).

### 2. Turns in check (or with no legal pass) use up the cap: nit (a design call, worth a line)

`packages/chess/src/bosses/hopper.ts:654`

Because the cap is `crowdMoves - warnAt`, his turns in check after the warning count toward the 3, even though the guard
never ran on them. Failing case: warned, then in check for 3 of his turns, then out of check with a piece hanging. On that
first free turn the cast is forced at once (difference 3) with no wait at all.

This is defensible ("3 of his turns after the warning" is what the settings comment says), but the FAQ reads as "it waits a
turn, at most 3", which a player will take to mean 3 waits. The counter in 1 settles it either way. If the crowd-move count
stays, say in the decision note that check turns count.

### 3. The admins' trigger on Chub & Chirp (`ultNext`, no warning) is still guarded with no cap: nit

`packages/chess/src/bosses/hopper.ts:653-655`

`HOPPER.ultimate` returns early when `t.ultNext` is set, so a trigger pulled before any warning leaves `warnAt` undefined.
Then `forced` is always false, and PASS_WAIT holds the cast for as long as passing loses material: the same "never ulted"
Eric hit, on the test tool. The watering's `any()` already lets the trigger through. This is admin-only, so it's a nit, but
the counter in 1 (or `|| p.ultNext` in `forced`, if the trigger should come anyway as Puddles' does) fixes it.

### 4. Stale comments and the area page: nit

- `packages/chess/src/runner.ts:2047`: `waterAny()`'s doc still says "(the test switch's first, or the admins' trigger)". Add
  "or ultWaitMax of his turns since the warning".
- `packages/chess/src/protocol.ts:1124`: the `water`/`waterAny` doc ("unless `waterAny`: the test switch or the admins'
  trigger") is stale the same way.
- `docs/areas/bosses.md:337` (the watering): "PASS_WAIT (the pass guard, unless the test switch's or the trigger's)" doesn't
  mention the cap. The Carrot Patch's pass-guard mention (line 333) doesn't either. CLAUDE.md asks for the area page to change
  in the same PR.

### 5. After the cap the server still asks the host for the cast's pass guard: nit (no harm)

`packages/server/src/lobby.ts:2541`

The `carrots` request still carries `pass: true` once the cast is forced. The host runs a guard search (`passGuardNodes`)
whose answer is then ignored, which wastes a search and a little wait on every forced cast. Optional: send `pass` only when
the cast isn't forced yet. A shared `carrotBattle.forced(b)` would keep the server and `apply` from drifting apart.

### Out of scope, for the record

- Puddles online still relies on the host to place the forced watering. With no engine on any device (`waterFrom` gives no
  pick, so the answer is ""), it keeps waiting past the cap. The server can't place it itself, so this was already true and
  is fine.
- Chandy's queen lock (a meter pick, not an ultimate) keeps an uncapped pass guard when the meter has no other unlocked move
  (`chandy.ts:1403`). That's the same "stays due forever" shape, if Eric ever sees it.

## Verdict

No blockers. Finding 1 is a real mismatch between the code and the FAQ on tower floors of several bosses. Counting guard
waits instead of crowd moves fixes 1 to 3 in about the same number of lines.
