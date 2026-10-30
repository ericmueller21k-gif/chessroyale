# Boss art: arena-statue

- Model claude-opus-5-5, effort medium, adaptive thinking. 7 turns, 3 renders.
- Spend: **$0.30** of the $2 cap (16 input, 27,964 cache-write, 106,201 cache-read, 7,143 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/arena-statue/arena-statue.ts.
- Previews: scripts/boss-art/out/arena-statue/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/arena-statue/looks/.

## Its notes

I've drawn arena-statue (`ARENA_STATUE`, name "Arena statue") in scripts/boss-art/out/arena-statue/arena-statue.ts. I checked it at 6x on both dark and light backgrounds, and at phone size beside the tiger. It reads clearly at both sizes.

- **Frame:** 40 x 80, on a transparent background. The foot is at (20, 79), the bottom center of the plinth's base. Nothing touches the frame's edge.
- **Animation:** `idle`, a single still frame (1000 ms).
- **The statue:** a giant marble pawn in the M/m/o marble colors, wearing a closed helmet. The helmet has a gold brim, a dark visor slit and a narrow marble crest standing on top. The pawn holds a big round shield on the left (marble face, gold rim and boss) and raises a short marble sword on the right (gold guard and pommel). It's lit from the top left and every part is outlined in `k`.
- **The plinth:** sandstone, with a stepped cornice, a body with a gold band, one joint line and a little sparse grain, and a wider base. It's shaded in bands with the coliseum's stone colors 1–6.
- **Palette:** the coliseum's keys and values, plus x, z, N and n, which are listed but not used.
- **Repeats and points:** none. It's a single standalone piece, so I didn't run a tile check, and there's no ground shadow, halo or exported points (no _SEATS).

Two things you might want to change:
- The crest is plain marble. Painting it gold or navy would add color, but the statue would no longer be all marble.
- The visor slit uses the dark `x`. Using the softer `o` would make the face gentler.
