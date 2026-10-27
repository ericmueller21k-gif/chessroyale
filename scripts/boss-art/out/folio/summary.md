# Boss art: folio

- Model claude-opus-5-5, effort high, adaptive thinking. 47 turns, 31 renders.
- Spend: **$2.97** of the $20 cap (96 input, 148,198 cache-write, 4,509,200 cache-read, 66,176 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/folio/folio.ts.
- Previews: scripts/boss-art/out/folio/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/folio/looks/.

## Its notes

Folio, third pass. I edited the second pass in place. The fold geometry, the pose rig, the outline, the paper pawn, the four eye settings, every animation's story and all timings are the same, except two changes to how the fading ink lines behave and a longer defeat ending (see below). I rendered every animation at 3–6x on dark and light backgrounds, and the idle at phone size beside tiger, gingerbread and moo.

What changed:
1. **Handwriting in ink.** The ink is now blue-black in three tones: #4f5d8e on lit faces, #36416b on mid faces, #232a47 on shaded ones. Each face gets a paragraph of 3–4 lines, 4 px apart: 3 on the body and far wing, 4 on the near wing, 6 on the loose page. The paragraph sits where the face is widest. The strokes are 1 px with rounded humps every 3–4 px, now and then a taller loop, 2 px gaps between words with a few longer ones, and each line stops short of the edge by its own amount. At 1x they read as lines of writing. When the crane is rattled, the smear runs in a lighter blue.
2. **Gilt edges.** A 1-px gold line (#e5ad45) runs along the near wing's leading edge, a deeper gold (#c9973c) along the far wing's, and gold along the outer half of the tail's lit edge. The glint in the entrance and smug now runs along that line: the gold brightens over about 5 px, spills onto the outline, and a small star flares off the edge.
3. **The seal.** A 6x6 vermilion stamp with clipped corners and a pressed-dark lower right. The pawn is knocked out in cream. It sits on the near wing's lit face and moves and folds with the wing; the writing keeps a 1-px margin clear around it. It's also on the loose page, the creased square and the bird base, so it's there from the first frame of the entrance. Defeat now ends with three new frames after the page lands: the writing fades off the page and only the seal is left. That makes defeat 15 frames and 4.8 s instead of 12 frames and 4.1 s.
4. **More contrast.** The mid, shaded and crease tones are a step darker (C #d3bd95, D #a58e69, E #76624c); the lit faces are still cream. Every fold now reads at 1x next to the tiger.
5. **The tiny crane in victory** is redrawn as a 9-px-wide cream crane with its outline and a gold wing tip. It flaps between a tall V of wings and a shallow glide, with a head to the left, a tail to the right and the body coming to a point. At 1x it reads as a little bird flying off.
6. **Brows.** Each eye setting now has a 1-px ink line above it, and the head's crown is 2 px taller to make room. Open is level, wide is lifted a row, narrow is lowered and slants down toward the beak, and happy is an arc sitting just over the closed arc eye.

Ink fades: the fading lines are now ink by default, not invisible. In the idle, a line on the near wing fades out and back in, then a second one does. Thinking keeps its story (three lines appear one after another, then fade together as the head comes down), but in the same ink instead of the old light blue.

Choices you might want to change:
- **Seal shape.** It isn't drawn rotated; the tilt is only suggested by the clipped top-left and bottom-right corners, since a truly rotated 5–6 px square broke up badly when I tried it. The pawn knockout is very simple (a stem on a 3-px base).
- **Seal in some poses.** When the near wing points at the board (move, check), its lit face is too thin for the seal. The seal and that face's writing drop out for those frames and come back when the wing returns.
- **Seal on the flat page.** On the page seen flat, in defeat and the entrance, the seal is a squashed 6x3 version so the perspective holds. Its red reads clearly, but the pawn shape barely does.
- **Happy face.** The happy brow and the arc eye stack into a small "^ over ^" shape on the dipped head. If it looks busy, the brow could be dropped for happy only.
- **Check underline.** It's still a lighter blue (#7486c0) than the writing, so it shows up on the dark ground.
