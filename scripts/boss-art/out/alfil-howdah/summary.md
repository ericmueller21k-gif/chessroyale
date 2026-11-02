# Boss art (rider): alfil-howdah

- Model claude-opus-5-5, effort high, adaptive thinking. 7 turns, 3 renders.
- Spend: **$0.57** of the $6 cap (16 input, 35,428 cache-write, 106,561 cache-read, 18,374 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/alfil-howdah/alfil-howdah.tsx.
- Previews: scripts/boss-art/out/alfil-howdah/preview/idle.png, scripts/boss-art/out/alfil-howdah/preview/move.png, scripts/boss-art/out/alfil-howdah/preview/look.png. Each look it took: scripts/boss-art/out/alfil-howdah/looks/.

## Its notes

Alfil's Howdah is drawn and both animations have been rendered and checked: idle at 4x, the town move, every color, the tile, and a black pawn on Midnight.

**What it is:** a shaggy brown baby mammoth seen from the side, facing right. It has a big round head with a top tuft, a big shiny eye, a pink cheek and a pink inner ear, a curled trunk, a small curled ivory tusk, four short legs with ivory toenails and a tufted tail. On its back sits a gold howdah (a small seat box). The pawn sits in it, and the howdah's front wall hides its lower part (lifted 26, hidden below y 70). Two gold corner posts rise from the wall: the back one has a gold ball and a small pennant, the front one a gold ball and a spike.

**Painted part (the item's color):** the caparison (the blanket over the back), the panel set into the howdah's gold front wall, and the pennant. The fur, ivory, pink, the gold trim, the 3 tassels and the small gold diamonds with a blue center stay fixed. I tried every color scheme; Pearl and Midnight read fine.

**Idle** (8 frames × 220 ms): a slow breathing bob of the body, howdah and pawn while the feet stay planted. The trunk sways and its tip curls up and back. The ear flaps once (frames 5–6). The tassels and pennant swing gently.

**Move** (8 frames × 110 ms, dx goes 0 → 87.5 in even steps, so the next move's frame 0 lands at 100 and follows on): one full walk cycle, the 4 legs stepping in turn a quarter-cycle apart, each foot lifting as it swings forward. The body dips twice per cycle, a heavy plod. The body and howdah rock gently back and forth (side to side can't show from the side, so it's a rock). The pawn sways a little behind that rock and leans a few degrees. The trunk swings, the tassels swing against the step, and the pennant flaps.

**Choices you might want to change:**
- **No canopy.** A roof over the pawn's head would go past the 9-unit limit above the square, so the canopy became the painted wall panel plus a pennant. A low canopy would only fit if the pawn sat lower in the howdah.
- **It reaches past the square.** It's shifted left so the howdah sits over the pawn. The head, trunk and tusk reach about 6 units past the right edge, and the tile frame is [0, -9, 112, 109].
- **The feet slide a little** in the walk, because the stride is shorter than the 100-unit step. It's hard to see at town size.
- **Cut 70** sits just under the wall's top edge, so nothing shows through when the pawn tilts.
