# Chandy's bar: sized by his body, his name beside him; his chirp (Nov 18, 2026)

**Eric, Nov 18 (his phone, dark):** "look at how all that stuff, his name and stuff, has moved too far to the right"; "he just obviously
needs to be bigger"; "I'm not worried if ... his gun overlaps a little bit or something above". And: "he makes like a squeak sound now.
It sounds like a bird chirping. He's a crocodile."

- **The cause:** the bar fit (`packages/app/test/bar-fit.ts`) measured every drawn pixel as the boss: his rifle slung up his back (117 px
  above his feet at full upgrade, his body 75) shrank him to 0.76, and the rifle held out level pushed his name 53 px right.
- **Fixed at the cause:** a kit names its props (`barProps`, part-name prefixes: his `"rifle:"`); size, shift and name column are the
  body's alone. A prop may rise over the bar's top, never off the screen (the size is also capped by that). Every other boss's numbers
  are unchanged. Same-flaw scan (idle under 90% of its fitted height): Moo (thinking, 74%: the Nov 12 call), Alfil, Smudgy, Puddles
  (thinking), Chub & Chirp (race won): poses, not props; not changed.
- **His bar:** 1.19 (was 0.76), his body as tall as the others'. `CHANDY_BAR` tips his firing poses 21° down at the board (the swing a
  little lower, its far arm down) so no frame reaches his name column's text and meters (`barUnder` 51 px, checked on the page every
  frame by e2e/chandy.spec.ts); his name sits 5 px from his body (`barName` 38). Beside the board he still aims level.
- **Over the bar's top:** his slung rifle rises over the "BOSS · move N" line once upgraded (at full upgrade, over its first letter):
  the "a little bit above" Eric allowed. Shorter would need the rifle redrawn.
- **Sounds:** `lock` (was two beeps at 1500-2250 Hz), `unlock` (1800-1150 Hz) and Dodge's `alarm` (940 Hz blips) remade low and
  heavy: a rounded pulse hum at 150-260 Hz that throbs, a growl or knock under it. At the pack's loudness (about 4 dB under a move).
