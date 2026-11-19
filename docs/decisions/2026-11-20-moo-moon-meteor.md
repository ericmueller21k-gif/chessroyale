# Moo & Moon's Full Moon: the moon comes down and bursts into light (Nov 20, 2026)

**Eric, Nov 20:** "this big moon ... it takes up basically the full width of the sky, and then it starts like coming downward ... almost
like a meteor ... four seconds for that first part, or 5 seconds ... then it starts glowing ... We want to reuse that one that Fable had
built for the hidden boss ... a massive beam of light that blasts, and it covers the full screen ... that's when it transitions and shows
... the close up ... you see that light sort of like hitting the cow and the moon a bit more."

**What changed:** the field 2.7 → 5 s (`MOO_CINEMATIC.fieldMs`); the Full Moon 11.08 → 13.38 s in all (his thinking waits for it, so no
clock runs). The field's moon is lifted as a sprite (`characters/moo-moon.png`, `scripts/lift-moo-moon.py`: its own pixels, nothing
drawn) and comes down over it, 1.65 → 1.95 times its size, gathering pace; then the Hidden Boss's light (`recluse-light.ts` and its
worker, untouched but for a `noShaft` flag): the glow, the rays over the whole screen, the white-out, whole at the cut; in the close-up
it dies back into the moon's side (top left, where the art's light streaks come from), and a warm `overlay` wash on the two of them eases
to 45% as their eyes whiten.

**Calls:** the moon comes down in front of the hills (a meteor coming at them, not a moonset) and always covers the field's moon, which
stays put under it (no sky behind it to redraw). No rim light: it would need new art; the wash and the rays do the lighting. Back in the
field after the close-up, the field's own moon, as before.
