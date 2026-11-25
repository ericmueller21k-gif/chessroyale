# Boingo's freeze: buried in his pie, not Ginger's ice (Nov 20, 2026)

- Eric (Nov 20), on the piece Boingo's pie froze (its second splat) drawn with Gingerbread's ice block: "Well it should be its own animation, not an ice cube."
- Now the piece stands buried to its waist in whipped cream (his pie's palette and parts: cream, crust bits, a cherry on top), drawn in code (`PIE_FREEZE`, `characters/effects/boingo.ts`; `EFFECTS.pieFreeze`): it heaps up as the second splat lands (just after the pie in its face), wobbles and drips while the freeze holds, and slides off the square (the cherry rolling away, his slide whistle down) as the freeze wears off, the piece clean. Ginger's ice is unchanged; the rule is unchanged.
- Calls: waist-high, not over the whole piece, so its head still shows which piece is frozen. The thaw has no event, so the slide plays from when this device first sees the freeze gone (`pieThaw`, as Ginger's Super Freeze melt), not on a device that joined after.
