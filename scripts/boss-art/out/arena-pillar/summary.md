# Boss art: arena-pillar

- Model claude-opus-5-5, effort medium, adaptive thinking. 8 turns, 4 renders.
- Spend: **$0.37** of the $2 cap (18 input, 23,903 cache-write, 109,904 cache-read, 11,546 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-pillar/arena-pillar.ts.
- Previews: scripts/boss-art/out/arena-pillar/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-pillar/looks/.

## Its notes

arena-pillar is a 24 x 96 frame with its foot at (12, 95). I looked at all 5 idle frames on the dark background; the light background was only checked before the last changes (bigger flame, moved sparks, darker right face). Reads cleanly at 4-6x and at phone size.

The piece:
- Pillar: square sandstone in the travertine keys 1-6. Two-step capital (rows 28-33); 14 px shaft (rows 34-85) of 9 px stone blocks with joints, side joints alternating course to course, and a little grain; stepped base and plinth (rows 86-94).
- Shading: light from the top left. Lit left face with a bright corner line; shaded right face, darkest at its edge; lighter tops on the capital and base steps. Outlined in k with a faint halo.
- Brazier: bronze-gold bowl on a short stem on the capital, in Y/y/O plus two added bronze keys, b and c.
- Flame: rises from inside the bowl, about 14-17 px visible above the rim, no outline. White-hot root (new key W), then pale yellow, yellow, orange (new key F), deep-orange tips (new key R).

idle: 5 frames x 120 ms (600 ms), looping; the pillar never moves.
- Flame: column heights change each frame, so the tallest tip moves (frame 0 centred, 1 right, 2 centred and tallest, 3 left, 4 right).
- Sparks: two rise out of step. One climbs the right side over 5 frames (pale yellow, yellow, orange, deep orange as it fades); the other is on the left and starts higher.

Repeating: none, it's a stand-alone prop placed one at a time.

Exports: ARENA_PILLAR (id "arena-pillar", name "Arena pillar") and ARENA_PILLAR_FLAME = { x: 12, y: 12 }, the flame's middle, for the glow.

Possible changes:
- The right-face shading is fairly subtle because the stone is so pale; make the split stronger if it reads flat in the arena.
- The bowl looks more gold than dark bronze; swapping O for b in the bowl gives iron/bronze.
- Only sprite.ts is imported, not kit.ts; the stone shading is worked out in the file.
- I couldn't list scripts/boss-art/out/ to match earlier arena pieces, and I didn't read coliseum.ts. Colours are exactly as the brief gives them, so it should still fit.
