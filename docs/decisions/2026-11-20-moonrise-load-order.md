# Moo's moonrise: no moon before the land (Nov 20, 2026)

**Eric, Nov 20, live on his phone:** "The first few frames you can see the moon behind the land because the moon loaded first."

**Cause:** the rising moon (`moo-moon.png`, 2 KB, small enough for the build to inline) and the field's sky and front
(`moo-field-layers.png`, 27 KB) were two pictures, so on a cold load the moon was drawn before the land.

**Fix:** the moon is now the layers' ninth frame (`scripts/lift-moo-field.py`; the eight others pixel for pixel as before), so the sky,
moon and front are one picture and can't arrive apart. The layered rise is drawn only once that picture has decoded (`prewarmCinematic`,
`layersReady`). A Full Moon that comes before then shows the field's own picture for its whole rise, with its moon already in place
behind the hills. That choice is made before the field's first frame and never changes mid-rise. Beats and totals are unchanged.
`moo-moon.png` and `scripts/lift-moo-moon.py` are gone. `MOO_LAYERS_MS=<ms> npm run frames:moo` holds the picture back to watch it.
