# Your pawn under the God King; Jefferson's shots in his boss card (Nov 11, 2026)

**Eric (iPhone 14 Plus, Jefferson):** "We need to just bite the bullet and put the king and pawn vertical. When space is
tight, this is too small and compact. They should be stacked, the king on top." And: "the fireworks on the right are cut
off. The fix is to move them horizontally into his boss container, where there's plenty of space, and other bosses use
this space anyway for their extras."

**What changed**
- A phone's strip (Boss alone): BossDock measures the strip's height and, where the two fit one above the other at least at
  their side-by-side size (58 × 62), stacks them in one column, the God King on top, each `--dk-k` times bigger (at most 2,
  the old two columns' width; capped so his canvas frame stays in the window). Otherwise side by side, as before.
- Jefferson's shots still up: the same sprite redrawn as a 99 × 9 row, in his boss card's prop slot (`barProp`, as Hollow's
  bulbs, Timber's workshop, Tick and Don Dough's timers), no longer over the board's right edge.

**Calls made**
- "Tight" is measured, not a device list: wherever stacking makes them no smaller, they stack. That includes a 768 tablet
  upright (its figures were the same 58 px as a phone's, just as small). A computer is untouched (its figures already grow).
- A Boss Battle party's strip stays side by side: its teammates stand under the two, and stacking would leave them no room.
- The raid's lone God King (no pawn) is unchanged.

**Seen, not fixed:** the Hidden Boss's phase 2 slow marks (`.rc-slow.col`, Recluse2.tsx) are a column 4 px right of the board,
up to 12 px wide: on a 428 px phone (14 px right of the board) about 2 px would run past the screen. Not the one-line move
(phase 2 has no boss card meters); left for the director.
