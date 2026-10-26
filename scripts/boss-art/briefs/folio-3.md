# Folio, third pass: give it a boss's presence

Folio, the paper crane (a final boss; the first brief, `scripts/boss-art/briefs/folio.md`, still holds: read it, and the
second, `folio-2.md`). Your second pass exists: **read your drawing first** (`scripts/boss-art/out/folio/folio.ts`) and
revise it with edit_drawing. Keep what works now: the fold geometry and its new volume, the pose rig, the outline, the
paper pawn it captures, the four eye settings, the stories of every animation and their timings.

## What to fix (the director's review of the second pass)
The crane is clean and well folded, but at phone size it reads as a plain beige paper bird: low contrast, no color, no
mark of its own. It is a final boss; it needs a signature. Three changes give it one, and two fix flaws.

1. **Bolder, smoother handwriting, in ink.** The faint sepia zigzags read as noise, not script. Use fewer lines and make
   them read as writing: on each large face 3 or 4 lines along its long axis, 3–4 px apart, in a deep blue-black ink
   (lighter on lit faces, darker on shaded ones, but always clearly visible at 1x). Each line is 1 px, with smooth
   rounded humps every 3–4 px (cursive, no sharp zigzags), an occasional loop, gaps between words, and lines of
   different lengths. At 1x they read as lines of handwriting; at 4x as cursive. The writing that fades in and out (idle,
   thinking) uses the same ink.
2. **Gilded edges.** Like an old book's gilt page edges: a 1-px gold line along the leading edges of the wings and the
   tail's tip, catching the light. The glints in the entrance and smug run along it. Gold only there: a thin accent,
   not a fill.
3. **Its seal.** A small vermilion stamp, about 5 x 5 px, on the near wing's lit face, the paper pawn's silhouette
   knocked out in cream inside it, slightly rotated as if pressed by hand. It's Folio's mark: it stays in every frame
   where that face shows, folds with the wing, and in defeat it's the last thing visible on the flat page as it settles.
4. **More contrast between faces.** Darken the shaded faces a step so every fold reads at 1x beside the tiger and the
   gingerbread man, while the lit faces stay cream.
5. **The tiny crane in victory reads as a bone.** Make it a small, clear crane: a V of two wings with a neck and a tail
   point, 7–9 px wide, cream with its outline and a pixel of gold, so it reads as a crane at 1x as it flies off.

And a small one: the eye. Add a 1-px ink line above it, a creased brow, so the face reads at 1x: level for open, lifted
for wide, lowered and slanted for narrow (focused, a little stern), and an arc for happy.

Then look at every animation again: at 4x on both backgrounds, and the idle at phone size beside other bosses (render's
`with`: try tiger, gingerbread and moo). Call done with notes on what changed.
