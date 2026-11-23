# Moo & Moon's Full Moon: a moonrise behind the hill (Nov 20, 2026)

**Eric, Nov 20** (a phone screenshot of the huge moon in front of the hills): "the moon should start half hidden behind the
horizon/grassy hill and then move upward into the sky for a few seconds (same timing as is now), moon should never be in front of
the background hill terrain ... the other zoom in part stays the same, so does the light but just make sure it's emitting from the
new moon location."

**What changed:** the moon (the field's own, lifted: `characters/moo-moon.png`) now rises over the same 5.5 s (the field's fade-in
and hold; every beat and the 13.38 s total unchanged) from its middle on the hill line (`moonFrom: { scale: 1, y: 57 }`, about half
hidden) to the field's own moon's place (`moonTo: { scale: 1, y: 0 }`), easing out (`moonEase`, replacing `moonPow`). Until the cut
the field is drawn as two layers lifted from its own pixels by `scripts/lift-moo-field.py` (`characters/moo-field-layers.png`): its
sky without the moon, the moon, then its front (hills, barn, silo, fence, grass, flowers; the sky between the fence's rails left
see-through, so the moon shows through it). The light is unchanged and comes from the moon's middle as it rises (`moonMiddle`),
so at the white-out from where it ends. The close-up and everything after: unchanged.

**Calls:**
- **Size: the field's own moon, not grown** (it's already 58% of the field's width, about two thirds of a phone's). Ending exactly in
  its place makes the field after the close-up (the original picture) the same moon, with no second moon and no jump; Eric's
  complaint was its place, not its size.
- **The moon's glow goes with it:** the sky layer fills the moon and its glow (about 30 art pixels past its rim) from the sky on
  either side in the same row, dithered in the sky's own colors, eased over neighboring rows. Leaving the glow would have shown a
  lit disk where the moon ends before it got there. The field after the close-up has its glow back (unseen across the white cut).
- No new art; nothing drawn by hand.
