# Folio, second pass: revise the drawing you have

Folio, the paper crane (a final boss; the first brief, `scripts/boss-art/briefs/folio.md`, still holds: read it). A first
pass already exists: **read your drawing first** (`scripts/boss-art/out/folio/folio.ts`) and revise it with edit_drawing
(or rewrite parts). Keep what works: the fold geometry and the pose rig, the palette and the light, the outline, the
stories of the entrance (a page folds itself into the crane), the defeat (it unfolds back into a flat page) and the
victory (it folds a tiny crane and sends it off), the timings.

## What to fix (the director's review of the first pass)
1. **The handwriting reads as bricks.** The ink is short dashes in staggered rows, so the faces look like stone. Make it
   read as a page of handwriting: thin continuous strokes, 1 px tall, gently wavy with small peaks or loops every 2–3 px
   (cursive), in long parallel lines across each face along its long axis (the page's ruled lines, folded with it),
   2–3 px apart, with short gaps between "words" and lines of different lengths. Fewer, longer marks; faint (sepia, see-
   through). At 1x they should read as faint lines of script; at 4x as cursive writing.
2. **It's thin and spiky, and light on screen.** Give it more volume: a fuller central body (the diamond under the
   wings, bigger and more present), broader wings with more face area (so the writing shows), and the neck and tail a
   little thicker (2–3 px) so they hold at 1x. At phone size beside the gingerbread man and the tiger it should have about
   their visual weight while staying elegant. Keep the frame about 100 px wide or less: shrink the geometry rather than
   grow the frame.
3. **The captured piece is a white blob.** The piece it picks up and tucks away must read as a chess pawn folded from
   paper: a small pawn silhouette (round head, a neck, a wider base), about 6 px tall, cream with its outline.
4. **A face, just a little.** The head is very small: make it a pixel or two bigger, with a 2-px eye (dark with a 1-px
   highlight) so it has a hint of expression: the eye can narrow, pleased (smug, victory), and widen (hurt, rattled).

Then look at every animation again, at 4x and the idle at phone size beside other bosses (render's `with`: try
gingerbread, tiger and moo), and call done with notes on what changed.
