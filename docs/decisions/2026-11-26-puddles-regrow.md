# Puddles' watering regrows the piece he'd lose by passing (Nov 26)

Eric: "if they're losing material, typically they gain it back ... for Puddles, if he's going to lose like a big piece, then he
should just basically regrow that same piece ... if he uses it when one of his pieces is at risk ... we could do his too then."

**What it does now.** When a knight, bishop, rook or queen of his hangs once he passes, and passing would lose it, the watering grows
that same kind of piece back for him. It comes first, before the seeds, and the seeds are placed on top of it as before, so the
engine counts it once in his gain. If the regrowth covers the loss, the watering comes now instead of waiting. If it can't cover it,
the pass guard still waits, up to `ultWaitMax` times. How it works: `docs/areas/bosses.md` (Puddles' row), `gardener.ts`'s header.

**The calls made here, and why:**

1. **The server names the kind; the host's engine decides whether.** `regrowKind` (pure, no engine) looks at the position after the
   pass and finds the piece of his the crowd nets the most from by the exchange check (`exchangeNet`, over the crowd's legal captures
   no plant stops). The crowd must net at least `passGuardPawns` (2) pawns of material from it, so never a pawn. The
   server puts that kind in the ask (`regrow`) and `waterCheck` accepts at most one regrowth, of that kind only, so a host can't invent
   one. Whether passing really loses that piece needs an engine, as the band does, so the server can't check it.
2. **The trigger is the engine's line, or `passLoses`, not `passLoses` alone** (the brief named only `passLoses`). With real
   Stockfish at 20,000 nodes, his knight lost to a pawn measured −1.8 when he was already a pawn down. That is under the guard's 2, so
   it would never have regrown, and the watering would have come and lost him the knight. When he was even with his full set it
   measured −6.1, but then a third knight can't grow anyway. So the regrowth comes when the engine's best reply after the pass takes a
   piece of that kind ("as the engine's line shows"), or when `passLoses` holds. It costs one search, only when something hangs.
3. **An extra outcome, not a replaced "nothing".** The seeds' rolls stay exactly what they rolled (`seeds` and `rolled` unchanged).
   The regrowth is its own outcome in `growth` (`regrow: true`), one more than the seeds, played as a grown piece. If it hung on a
   "nothing" roll, it would come only when a seed happened to roll nothing.
4. **It aims at no gain.** Its square is the option (of `waterLooks`, its guards passed) that leaves his gain nearest 0 after it,
   under the band's top: it makes up the loss and adds nothing. The seeds then aim at `waterTarget` on the whole board, so his total
   stays near the target, not double. With Stockfish: a hanging knight regrown, his total +1.1 to +1.7 across three rolls.
5. **The hard guards stay.** No check, no mate in one, the crowd always has a move, never a ninth pawn, and the full-set rule. While
   all eight of his pawns stand he can't grow a third knight, so in that case the guard waits as before. There is no regrowth with
   `noAdd` (a tower floor whose primary boss is another adder), and a regrown queen isn't the jackpot (no lifted top, no big cheer).
6. **Unchanged when nothing hangs:** no extra search, and the code path is the same as before. The unit test checks 12 seeded
   positions against the answers the old code gave.

**Not changed, seen while testing:** a seed step can still pull his total far below the band (−6.99 in one Stockfish probe with
plain plants and a killer plant, on main too). The greedy has no floor, and then the pass guard waits. That's for the director.
