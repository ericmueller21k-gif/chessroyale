# Boss art: house-tower

- Model claude-opus-5-5, effort high, adaptive thinking. 21 turns, 13 renders.
- Spend: **$1.52** of the $5 cap (44 input, 88,892 cache-write, 1,161,648 cache-read, 42,259 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/house-tower/house-tower.ts.
- Previews: scripts/boss-art/out/house-tower/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/house-tower/looks/.

## Its notes

**Battle Tower front** (`scripts/boss-art/out/house-tower/house-tower.ts`): an Art Deco skyscraper in HunChess slate and gold. It exports HOUSE_TOWER (id `house-tower`, "Battle Tower", idle only), HOUSE_TOWER_SIGN, HOUSE_TOWER_DOOR, HOUSE_TOWER_LIGHTS and HOUSE_TOWER_POOLS. It imports only sprite.ts and kit.ts.

**Checks:** I rendered it on dark and light at full size, looked at the base and the top at 4x, and stepped through the idle frames. The house-gardener and house-tiger checks ran, but the render cut the other home off the bottom of the picture, so I never saw them side by side. By the numbers (592 px tall against the Walk-up's 224) it is clearly the tallest home on the street.

**Frame:** 144 x 592, foot [72, 586]. A ground shadow lies under it (ellipse round (72, 586), rx 72, ry 4). I drew the outline myself as a `k` ring round the building, made before the top dissolves, so no outline rings the dithered pixels.

**Numbers for the box (y is measured down from the top of the picture; "over the foot" = 586 − y):**
- **Base (lobby floors):** x 4–139 (its gold cornice reaches 3–140). Top at y 496, so 90 px over the foot.
- **Shaft:** x 12–131, from y 496 up to y 236 (350 px over the foot). A gold ledge caps it at y 236–239.
- **Setback:** x 24–119, from y 236 up into the sky.
- **Dissolve:** solid below y 128 (458 px over the foot). Above that it thins in a 4x4 ordered dither (see-through pixels, not a sky color) until nothing is left above y ≈ 10. From y 198 (388 over the foot) the higher pixels also pale one shade, like air in front of them.
- **Door middle:** x 72 (HOUSE_TOWER_DOOR). Its gold frame is x 54–89, y 541–581.
- **Sign face:** HOUSE_TOWER_SIGN = signFace(38, 519, 68, 20) = {x 40, y 522, w 63, h 14}. It's blank cream in a gold frame made with signBoard: no letters.

**Design:**
- **Base:**
  - A gold cornice, then the chessboard frieze across the full width: two rows of 4-px tan and brown squares.
  - Slate piers with stepped gold capitals.
  - Two tall lobby windows lit warm. Their upper panes have a gold fan pattern, and the checkered floor shows at the bottom.
  - A gold sunburst (half sun with rays) over the sign.
  - The glass front door sits in a deep portal with gold strips down each side: a transom over two leaves, long gold handles, and through the glass the clerk's counter and the checkered lobby floor.
  - Two gold-and-frosted-glass sconces beside the door, and two pale stone steps.
- **Shaft:** floors 10 px apart, so about 49 floors show. There are 9 window bays, and 7 above the setback. The edge piers each carry a gold line, and the two piers beside the middle bay carry gold lines all the way up into the dissolve. Most glass is dark slate with an occasional glint; about 15% of windows are lit warm, scattered by a fixed hash of (x, floor).
- **Clouds:** three flat-bottomed wisps (white, with pale blue-white undersides and no outline) drift across the dissolve.

**Idle (6 frames x 600 ms, loops):**
- About 9 shaft windows switch, each lit for half the loop from its own starting frame, so 2–3 windows change each frame.
- A white glint slides down both door leaves, 4 px a frame.
- The clouds drift 1 px back and forth.
Nothing else moves.

**Lights:**
- Both sconces (strength 0.9, with a halo).
- The door glass (0.8).
- Both lobby windows (0.7).
- One spot over the whole solid shaft keyed to the lit-glass colors (0.55), so lit and switching windows glow at night.

**Pools:** one in front of the door (rx 30) and one under each lobby window.

**Choices you might want to change:**
- The gold lines on the middle piers run up into the clouds. They give the tower a strong vertical, but they're the brightest thing in the dissolve.
- On a dark night sky the dissolve is subtle, dark slate fading out. On a day sky it reads as dark specks thinning into pale.
- The lobby windows are about as bright as the door. The portal, sign and sunburst are what make the door stand out.
- There's a leftover debug setting in the file, `VIEW`. It's set to the full picture, so it changes nothing.
