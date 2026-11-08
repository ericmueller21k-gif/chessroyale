# Review of #561 (Dash's Scramble Rush: solo counts only you; the extra move always matches the verdict)

Boss lane, one read-only pass. Branch `claude/dash-rush-extra` at 703dfe5.
Quick checks: `npm run typecheck` passes; `vitest run dash.test.ts boss-kit.test.ts move-list.test.ts`: 3 files, 50 tests pass.

**Verdict: no blocking findings.** The line and the move now come from one field (`rush.extra`) decided in one place, and I
couldn't find a path where they disagree:

- **Solo:** `finishRush` sets "skipped" only when `passTurn`/`extraMoveCandidates` give no move; otherwise "due", and
  `applyExtraMove` always plays (engine pick → `rushStandIn` from the seed). The board can't change between the two (the crowd's
  turn waits on `rushDue`/`extraMoveDue`), so the same check gives the same answer. Engine error: `.catch(() => null)` in
  `playExtraMove`, plus solo's own `.catch(() => applyExtraMove(null))`: both reach the stand-in.
- **Online host / server stand-in:** a host that sends "" or a non-candidate → stand-in; no host / timeout → `bossTimeout` →
  `playBoss("")` → `applyExtraMove(null)` → stand-in. The stand-in is `powerRoll(seed, "rush-extra", at)` over sorted candidates,
  computed only on the server and broadcast, so devices can't drift.
- **Check:** the Rush is only set when `passTurn(t.fen)` works (`t.fen` is the crowd-to-move position, per `prepareTurn`), and the
  same position is used by `finishRush`. It can't fire twice: `rushWarned` turns false once `rush` is set, and the `return` comes
  before the warn branch. It can wait forever if the crowd is in check at every turn start until the end, which is fine.
- **Solo "only you" when you're not in:** `you.alive` false → `{}` with no `only` → the bots' mean, as online. If `you.alive` is true
  but HUMAN somehow isn't in `b.alive()`, `judged` is empty → `rushHeld([])` → held: it fails safe (no extra move, "well done").
- **`rowNumber`:** the history always starts from `START_FEN` and `passTurn` bumps the move number when Black passes, so normal rows
  read as before and passed turns (Dash's extra move, Hollow's) read right (14… after 13…; 15. after White's extra). `moverOf`
  still goes by color plus `floor`, which stays right after one pass. The only FENs pinned to "0 1" are test switches
  (`PAINT_TEST`, Chess960/autochess, which aren't boss move lists).

## Findings (non-blocking)

1. **`packages/chess/src/bosses/dash.ts:557` (+ `DashRush.tsx:137`): online the rounded crowd count can read as a pass while the
   verdict is a fail.** Severity: low-medium (online only; the line and the move still agree, but the number looks wrong).
   `correct: Math.round(mean * 10) / 10` rounds while `rushHeld` uses the exact mean. With `needCorrect` 4, a raid mean of 3.96
   (99 of 25 people) or 3.98 (199 of 50) is stored as 4, and the dock now shows **"Crowd: 4 of 6: too few"** and he moves again.
   This PR is the first to put the crowd's count on screen, so it's newly visible. Fix: round down for the stored count:
   `Math.floor(mean * 10 + 1e-9) / 10` (a mean that held, being at least `need - 1e-9`, never shows under `need`; one that failed
   never shows `need`). Or decide `held` from the rounded value; that's a small rule change, so the first fix is better.

2. **`packages/app/src/components/DashRush.tsx:135-137`: "(On average; you: N.)" for someone who wasn't in the put-back.**
   Severity: low (copy). Solo after you're out (bots' mean), or online for a spectator or a player who is out, `right` is worked
   out from that viewer's empty `view.places`, so the sub-line says "you: 0" (or whatever an empty put-back counts) for someone
   who never played it. Fix: show the "you" part only when the viewer was in it (solo: `you.alive`; online: the viewer is in
   `rush`'s judged players), else just "Crowd: X of 6".

3. **`packages/chess/src/bosses/dash.ts:395-399` (`dashExtraMoveFrom`): the fallback can pick a move with a forced mate in its
   line.** Severity: low (very rare). When every candidate outside the cap has `mate` set, `pool` is all of them, and the one
   "closest to before" can be a mate *for him*: a quiet extra move that decides the game, which Hollow's rule never allows. Fix:
   prefer, in order, no mate, then mates against him (`mate < 0` from his side), then his own; or fall to `rushStandIn` when only
   his own mates are left. (Check the sign convention of `MoveScore.mate` against `pickExtraMove`.)

4. **`packages/app/src/solo.ts:931`: an engine that hangs (never resolves, as opposed to throwing) still leaves the extra turn
   waiting.** Severity: low; it was already like this for Hollow. The `.catch` covers errors only. If the solo engine has no
   timeout of its own, wrap the pick in a race with a timeout (e.g. `bossThinkMs` + a few seconds) that falls back to
   `applyExtraMove(null)` (the stand-in). Worth a follow-up, not this PR.

## Not found
- No desync: every seeded choice (`rushStandIn`, `botRushCorrect`, `chooseRush`) runs from the battle's seed on whichever single
  authority applies it (the server online, the runner in solo).
- Hollow is unchanged: `hostExtra` picks `dashExtraMoveFrom` only for `dash`, and `hollowBattle.applyExtraMove` isn't touched.
- Crowd turns / other bosses: `rowNumber` only changes the label; no ply-indexed logic moved.
