# Boss art: arena-town-badge

- Model claude-opus-5-5, effort medium, adaptive thinking. 4 turns, 2 renders.
- Spend: **$0.31** of the $3 cap (10 input, 24,935 cache-write, 40,753 cache-read, 8,834 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-town-badge/arena-town-badge.ts.
- Previews: scripts/boss-art/out/arena-town-badge/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-town-badge/looks/.

## Its notes

The crest is finished and I rendered it on both the dark and light backgrounds. I also looked at it at phone size (1x and 2x), where the pawn, the roofs and the gold ring still read clearly.

- **Size:** the frame is 40 x 40 with a transparent background, meant for 2x (80 px on the button). It is exported as `ARENA_TOWN_BADGE` with the id "arena-town-badge" and the name "Chess Town crest".
- **The picture:** a round crest with a gold rim, shaded from the top left (`y`/`Y`/`O`), with 8 small rivets, a dark inner ring and navy sky inside. A big white pawn stands in the middle. Behind it on the left is a cream house with a red roof, a lit window and a door. On the right are a clock tower with a gold clock face and a small house in front of the tower's foot. The bottom of the circle is a band of grey cobbles. The whole thing has a `k` outline and a faint gold halo (`#ffe08a33`), so it reads on the dark panel and the light one. There are no letters or numbers.
- **idle:** 4 frames of 300 ms each, looping.
  - Frames 0 to 3: a star-shaped glint moves a quarter of the way round the rim each frame, starting top left and going clockwise.
  - Frames 2 and 3: the right house's window lights warm gold (`v` turns to `#ffd36a`), then goes dark again when the loop restarts.

**Choices you might want to change:**
- The circle clips the houses and the tower top, so the tower's roof tip is cut off by the inner ring.
- The roofs are red (`r`/`R`/`p`), my own pick for colour against the navy. I didn't read the town's house files, so they may not match the town's roofs.
- Only the right house's window turns on and off. The left house's window and the tower's window stay lit all the time.
- The glint takes 4 big steps round the rim. More frames would make it travel more smoothly.
