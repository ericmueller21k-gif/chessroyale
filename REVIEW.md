# Review: Puddles' regrowth (`claude/puddles-regrow`, head 0440ff0e)

Boss lane, one quick read-only pass. Read: the whole diff, `docs/decisions/2026-11-26-puddles-regrow.md`, `gardener.ts` on the
branch (ask, any, apply, waterFrom, waterCheck, waterGrowth), the lobby's water request (`lobby.ts:761`) and the app's
host path (`net.ts:972`). One unit-level probe run (reactionOf below). No blockers.

## Findings

1. **should-fix: a regrown queen gets no reaction at all.** `packages/chess/src/bosses/gardener.ts:546-548`. `reactionOf`
   skips a regrown queen for the big cheer (as meant), but its "cheer" line lists only `p n b r`, so the queen counts for
   nothing. Failing case (run): `reactionOf([{kind:"q",square:"d4",regrow:true},{kind:"nothing",square:"a3"}])` is `null`,
   and with a plant instead of the nothing also `null`; a regrown knight with a plant is `"cheer"`. The comment says
   "a regrown one is a piece", so it should cheer. Fix: in the cheer check, count `g.kind === "q"` too (the big-cheer check
   above it already took the seed's queen).

2. **nit: the app still treats a regrown queen as a queen bud with its chime.** `packages/app/src/components/Gardener.tsx:150`
   (`budQueen`) and `:410` (the `gardenerChime` for every `kind === "q"`). Not wrong (it is a queen), but if the chime is
   part of the jackpot's feel, a regrown queen gets that much of it. The director's call; `waterMs` and the app agree either way.

3. **nit: the `takes` trigger doesn't check the take loses him anything.** `gardener.ts:420`. It fires when the engine's best
   reply after the pass captures any piece of the named kind. When regrowKind named a knight that only hangs by the
   exchange check (a pin or tactic makes taking it bad) and the engine's line instead trades his other knight evenly,
   `takes` is true while `passLoses` isn't, and a knight grows for a near-even pass: up to the band's top (2.5) for him.
   Bounded by the band and rare; noting it, no change asked. (A tighter trigger: the line takes a piece of that kind and
   the pass's gain is below the band's bottom.)

4. **nit (known, decision call 1): the server can't tell a needed regrowth from an unneeded one.** `waterCheck`
   (`gardener.ts:487-494`) accepts one `g<kind>` of the named kind on any square the rules and guards allow, whatever the
   engine would say. A host is a crowd player, so the only gain from abusing it goes to the boss; same trust as the band
   for the seeds. No action.

5. **nit: the protocol's doc for `water` doesn't mention the regrowth.** `packages/chess/src/protocol.ts:1122-1126`: no word
   of `regrow` in the ask or the `g` token in the answer (the `WaterAsk` doc has it).

6. **nit: the new e2e's comment miscounts.** `e2e/gardener.spec.ts` (new test, the FEN comment): "seven pawns of his", but
   `p1ppppp1` is six. The test still holds (not a full set).

7. **nit: a named regrowth costs one search of the budget even when it doesn't regrow.** `gardener.ts:416-418` (`budget--`).
   With waterBudget 48 and waterLooks 4, ten seeds with killers can hit the budget, so the last seed may get one fewer
   option than on main. Only when something hangs by the exchange check, so "nothing hangs: unchanged" still holds.

## Checked, nothing found

- **Fairness, online:** the server names the kind (`ask` → `regrowKind` on the server's board and plants); `apply` rebuilds
  the same ask from the unchanged board. `waterCheck` refuses a `g` token with none named, another kind, a second one, a
  seed's letter for it, a taken or plant square (`used`, `placeOne`); a killer can't then eat the regrown piece (its square
  is in `used`, so `waterGrowth`'s `pieceAt(passed, …)!` never meets an empty square). Solo and online run the same `ask`,
  `waterAnswer`, `waterCheck`. Old hosts ignore `regrow` and answer as before.
- **Hard guards:** the regrowth goes through `stepOptions` (placeOne + waterGuard) in the search and placeOne + waterGuard in
  the check: no check, no mate in one either side, the crowd keeps a move, never on a plant, the full set via
  `stockfishRefuses` (the FULL unit test). Not a pawn (`RegrowKind`), so never a ninth.
- **Gain:** one outcome, placed first, top waterBand[1], target 0; the seeds' gains are measured on the whole board after
  it, so it's counted once and the band's top still caps every step. A seed queen still sets the jackpot; a regrown one
  doesn't (`jackpot`, `result.jackpot`, bigCheer all exclude `regrow`).
- **Pass guard and #972:** `waterAnswer` still applies `passLoses` to the final gain; a regrowth that can't grow (full set)
  or doesn't cover it gives PASS_WAIT, `waits` counts it, and `any` forces it after ultWaitMax (the forced one still tries
  the regrowth). `waits` cleared on a watering as before.
- **e2e:** the two changed checks only drop `regrow` outcomes from the count of ten; the new spec asserts a `regrow` growth
  of kind `n` with a black knight on its square, which only the regrowth path can produce.
- **Nothing hangs:** `regrowKind` null → no `regrow` in the ask → `waterFrom` runs exactly the old path (the 12-position
  unit test pins it).
