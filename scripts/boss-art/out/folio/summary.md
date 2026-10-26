# Boss art: folio

- Model claude-opus-5-5, effort high, adaptive thinking. 35 turns, 19 renders.
- Spend: **$1.94** of the $20 cap (74 input, 110,341 cache-write, 2,441,394 cache-read, 45,114 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/folio/folio.ts.
- Previews: scripts/boss-art/out/folio/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/folio/looks/.

## Its notes

I revised Folio and looked at all 11 animations again: the idle at phone size beside the gingerbread man, the tiger and moo, and the others at 3–5x. The fold geometry, the pose rig, the palette, the light, the outline, the timings and the stories of the entrance, defeat and victory are unchanged.

The four fixes:
1. Handwriting. The dashes are gone. Each face now has thin 1-px cursive strokes, 3 px apart, in long lines running along the face. The stroke lifts a pixel every 2–3 px for small humps, with an occasional loop, and joins up within a word. There are 2-px gaps between words and now and then a longer blank, so lines end at different lengths. The ink is a faint sepia in three tones (lit, mid and shaded paper), so it stays faint everywhere. At 1x it's a soft lined texture; up close it reads as scribbled script, though the humps lean a bit zigzag. The loose page in the entrance and defeat shows it best. The lines that fade in and out (sepia in the idle, ink-blue in thinking) now run along the near wing's front face.
2. Volume. The body diamond is bigger and hangs lower. Both wings bow out along one edge, so they're broad flaps with more room for writing; the near wing has a third, shaded face. The neck and tail are 3 px at the tip and wide at the base. Still 97×92. At phone size it holds its own beside the gingerbread man, the tiger and moo.
3. Captured piece. It's now a 6×7 paper pawn with outline: round head, neck, collar and a wide base, with a crease down its shaded side. At 5x it clearly reads as a pawn.
4. Face. The head is 1–2 px bigger and the eye is 2×2, dark with a 1-px glint. A new eye setting gives four looks:
- open: the normal eye.
- wide: taller; used in hurt while it's being crumpled and in rattled while it shivers.
- happy: a closed ∩ arc; used through the smug bow and glint and at the end of victory.
- narrow: a slit; used for a one-frame blink in the idle (frame 19), as it steadies after hurt and rattled, and as defeat begins.

Each animation, beat by beat:
- Idle: two slow breaths with the wings rising, one head dip, one blink, two lines of writing fading in and out.
- Entrance: a bigger page drifts down rocking, then folds into a creased square, the bird base and the petal fold. The neck and tail swing up, the head folds, the wings open and a gold glint runs up the wing edge.
- Thinking: the head cocks up and three ink-blue lines write themselves along the near wing, then fade together.
- Move: the near wing sweeps forward, points at the board and sweeps back with a rustle.
- Capture: it dips its beak, comes up with the paper pawn and tucks it under the lifted wing.
- Hurt: the trailing edge crumples, the tip folds over and the crane shudders wide-eyed, then smooths out.
- Check: the neck stretches tall, the wing points and a blue underline draws itself under it.
- Smug: a happy-eyed bow while a glint runs up the wing edge.
- Rattled: the wing edges curl, the ink runs and the eye goes wide, then it steadies.
- Defeat: it unfolds through the bird base and the square to a flat page, which tips and settles on the ground.
- Victory: it folds a tiny crane at its beak (square, kite, crane), launches it, watches it go and bows, happy-eyed.

Choices you might want to change:
- When the fading lines are out, the near wing's front face has a little less writing. That's on purpose, so the writing visibly comes and goes.
- In move and check, the pointing wing bows into a broad blade rather than a thin point.
- The pawn is 7 px tall, one more than the brief's "about 6"; that row is for the collar.
- The open eye is small at 1x. It reads at 2x and up.
- The humps in the handwriting lean a little zigzag. Spacing them every 3–4 px would give smoother cursive.
