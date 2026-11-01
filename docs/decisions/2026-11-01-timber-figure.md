# Timber's figure on a computer (Nov 1, 2026, round 2)

Timber's figure stood over the board's top-left squares (a8, b8, a7, b7) and over the boss bar's left end when he cast his
Gnaw, and his rest drawing ran 18 px over the board's left edge (his frame's box). `bosses.md` says no boss's drawing goes under
the board and every other boss stands beside it on a computer, so this is fixed for him.

- **His cast on a computer** (900 px and up, 600 px tall): beside the board at its bottom-left, his feet on the board's bottom
  edge, his frame's right edge at the board's left edge. Its width is 31% of the board, 20% from 900 to 1099 px, where his rest
  figure is drawn at 1x. A phone's cast is unchanged (the corner).
- **At rest:** `--bc-shift` of 10 sprite px out, as Folio's 6, so his drawing clears the board by 16 to 20 px, as Folio's does.
- **Unchanged:** the frame (98 x 129, room for his entrance's drop), his phone bar, the board's size and place.
- **Call made:** the other bosses' corner casts (Folio, Babur, Moo) still cover the board's corner on a computer, as
  `bosses.md` describes them. This is Timber's alone; whether the others should match is for the director.

Guard: `e2e/timber.spec.ts`, "on a computer his figure stands beside the board, at rest and in his Gnaw". Measured boxes:
the board is 346 px from the left at 1280 x 800 and 1440 x 900, the same as Folio's there.
