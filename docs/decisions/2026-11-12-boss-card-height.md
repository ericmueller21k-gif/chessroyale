# Every boss as tall as his card (Nov 12, 2026)

**Eric (Don Dough's card on his phone, small in its left corner):** "every boss as tall as their container... make it the height,
minus a few pixels, of the container, and then if it reaches over to the left, which some probably will, then just shift everything
over to the right. Like the elephant would probably need to be pushed over to the right, but we can just shove over his name and stuff."

**What changed (phone only; a computer's bar is unchanged)**
- Each boss's size in the bar is measured from its art: the largest hundredth at which every frame it rests in reaches no higher
  than `BAR_TOP_GAP` (3 px, kits.ts) under the bar's top. The drawing's shift and the name column's move right are the least that
  keep it inside the bar's left edge and clear of the name (`packages/app/test/bar-fit.ts`, `scripts/bar-fit.ts`).
- The name column is only as wide as its name and bars (at most 130 px), and "N moves left" never wraps, so the moved column takes
  its room from the empty middle. The boss's own room is a container: Don Dough's two timers size themselves to it.

**Calls made**
- "Rest" leaves out the victory loop (arms up, the battle won, at its end): it's what kept Don Dough at 0.9 (his idle 73 px of 96).
  It plays as a moment, over the bar's top if it reaches, never off the screen (the unit test checks every frame).
- The old caps go: "never more than its own size" and the big animals' 1/12 steps, and with them the check that each big animal
  stands at least as tall as Ginger, Sawyer, Smudgy and Chub & Chirp (everyone now fills the bar).
- Moo & Moon (0.96) and Puddles (1.15) stay a little shorter than the rest: their thinking pose, every turn, is their tallest frame.
- Every boss with a character is measured, the admins-first ones (Timber, Dash, Don Dough) and the Hidden Boss's bust too.
