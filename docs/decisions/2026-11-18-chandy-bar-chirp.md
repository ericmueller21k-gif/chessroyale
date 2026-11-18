# Chandy's bar gap and his chirp (Nov 18, 2026)

**Eric, Nov 18 (his phone, dark):** "look at how all that stuff, his name and stuff, has moved too far to the right"; "he makes like a
squeak sound now. It sounds like a bird chirping. He's a crocodile. Like it's got to do something different."

- **The cause:** not his frame's width (the bar places every figure by its feet and measures drawn pixels, Dash too): his rifle held
  out level at full upgrade (his `aim` loop, a rest frame) reached 104 px right of his feet, so `barName` was 53.
- **The fix (bar only):** a phone's bar draws `CHANDY_BAR`, his firing poses tipped 12° down at the board, which runs every frame of
  the rifle (its swing too) under his name column's meters (they end 51 px under the bar's top: `barUnder`, checked on the page by
  e2e/chandy.spec.ts). `barName` is measured above that line only: 6. His name never moves; the rifle never touches it; his words
  (z-index above) cover the rifle while he talks. Beside the board (a computer) he still aims level, as approved.
- **His size, measured, left as is:** he is not too big: 65 px tall at rest against 80 to 94 for the others (Moo 69). His full-upgrade
  rifle slung up his back (117 px above his feet) sets his scale (0.76); taller would need that rifle drawn shorter or lower: Eric's call.
- **Sounds:** `lock` (was two beeps at 1500-2250 Hz), `unlock` (1800-1150 Hz) and Dodge's `alarm` (940 Hz blips) remade low and heavy:
  a rounded pulse hum at 150-260 Hz that throbs, a growl or knock under it. Nothing else in his pack beeps that high (the spark's ring
  sits under its crackle). Each at the pack's loudness (about 4 dB under a move).
