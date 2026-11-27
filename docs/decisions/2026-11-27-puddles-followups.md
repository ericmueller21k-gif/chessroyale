# Puddles' watering: the regrowth's follow-ups and a floor (Nov 27)

Eric (Nov 26): "if he's going to lose like a big piece, then he should just basically regrow that same piece." Follow-ups to #983's review:

1. **A regrown queen is a regrowth:** a plain bud, no chime, the cheer. `growthArt` is the one answer for the screen and the timing.
2. **An even trade isn't a loss.** The engine's line must win a piece of that kind by the same exchange check that named it. "The gain below the band's bottom" would not do it: the bottom is +0.5, so an even trade (about 0) still passes.
3. **The pass alone is searched first, outside the budget,** like the position before. A regrowth that doesn't come never costs the seeds a search.
4. **A floor:** no outcome leaves him more than `waterFloorMargin` (0.5) under the band's bottom, or under where he stood before the seeds if that's lower. Otherwise it comes up as nothing. The floor is relative because a fixed one would drop every plant whenever the pass alone is low. In 24 waterings with real Stockfish it changed none.
