# Boss art: birdie-train

- Model: the art model, effort high, adaptive thinking. 23 turns, 21 renders.
- Spend: **$1.73** of the $5 cap (48 input, 103,393 cache-write, 1,645,953 cache-read, 44,055 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/birdie-train/birdie-train.ts.
- Previews: the final preview failed: /home/user/chessroyale/scripts/preview-characters.ts:303
  const idle = ch.anims.idle!.frames;
                              ^

TypeError: Cannot read properties of undefined (reading 'frames')
    at <anonymous> (/home/user/chessroyale/scripts/preview-characters.ts:303:31)

Node.js v22.23.5
. Each look it took: scripts/boss-art/out/birdie-train/looks/.

## Its notes

I drew the train as board art, not a boss: the `BIRDIE_TRAIN` export, id "birdie-train", w 64, h 32, foot [32, 31], with only the three animations the brief asks for. The renderer still lists the boss animations as missing, which is expected here. There are no letters or numbers anywhere. The colours come from Birdie's train and cap palette, plus three see-through colours: the floor shadow, the red lamp glow and the headlight beams. I checked every animation on dark and light squares. I couldn't put an actual piece over the crossing in the renderer, so the "under a piece" check is a judgement, not a render.

**ride** (loops, 4 frames × 105 ms): the yellow toy diesel seen from above, nose to the right, filling the 64 × 32 frame.
- **Body:** a pale top edge and a darker bottom edge, the thin red stripe along both sides curving round the nose, and a rounded nose hood with three grille slats and two headlights.
- **Roof:** dark grey, with a seam and the windshield (two panes and a post).
- **Birdie:** seen from above in the open hatch, with the hatch lid standing up behind him. His long tail lies over the roof, his folded wings are scalloped with dark spots, and his head faces forward in the cap (navy top, gold band, black brim). His eyes show at the sides and his beak pokes out past the brim.
- **Frame by frame:**
  - The tyres' tread marks roll forward.
  - The rods between each pair of wheels move in and out on frames 0–1 vs 2–3.
  - The exhaust stack's glow pulses red on alternate frames.
  - Grey smoke puffs drift back off the stack, growing and thinning.
  - The headlight beams change length.
  - His head nods forward 1 px on frame 2.
- **Shadow:** offset 2 px down and right.
- **Phone size:** it reads as a yellow toy train with a little capped bird in it.

**crossing** (loops, 6 frames × 165 ms ≈ 1 s): drawn only in the left square (x 0..31); the right half is empty.
- A white crossbuck (two crossed bars) with a dark outline and a faint halo.
- A red lamp in the open space on either side of the crossing.
- The lamps swap every frame: the lit one is bright red with a hot core and a glint, a see-through red glow and short rays. The unlit one goes dark maroon.
- A piece standing in the middle covers the crossing point of the bars, but both lamps sit to the sides and should stay visible.

**smash** (one shot, 5 frames, 420 ms): left square only.
1. A bright 8-point white-gold star (60 ms), with `cue: "smash"` on this frame.
2. A round puff of tan dust with sparks shooting out (80 ms).
3. The puff spreads into a ring with a hole in the middle, sparks further out (90 ms).
4. A wider, lumpier ring with a few last sparks (100 ms).
5. Faint scattered wisps with no outline, fading out (90 ms).

**Choices you may want to change:**
- **Lamp placement:** the lamps sit left and right of the crossbuck so a piece in the middle doesn't hide them. The left lamp's glow is cut off flat at x 1 so nothing touches the frame edge.
- **Flash rate:** the lamps alternate every 165 ms, about 3 swaps a second. That's faster than a real crossing, because the brief says to alternate each frame.
- **Smoke:** it's grey (it's a diesel) and fairly faint, mostly over the back of the roof. It could be bigger.
- **Hatch lid:** it's drawn standing up (a thin bright line just behind Birdie) rather than flipped flat onto the roof.
- **Birdie at phone size:** at 1x he reads as a small brown bird with a navy cap. The face detail only shows when zoomed in.
