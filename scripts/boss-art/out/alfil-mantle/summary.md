# Boss art (item): alfil-mantle

- Model claude-opus-5-5, effort medium, adaptive thinking. 6 turns, 3 renders.
- Spend: **$0.32** of the $3 cap (14 input, 23,803 cache-write, 61,332 cache-read, 9,454 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/alfil-mantle/alfil-mantle.tsx.
- Previews: scripts/boss-art/out/alfil-mantle/preview/frames.png, scripts/boss-art/out/alfil-mantle/preview/look.png. Each look it took: scripts/boss-art/out/alfil-mantle/looks/.

## Its notes

I drew Alfil's Mantle (epic skin): the pawn wears Alfil's caparison as an open-front cape. Both halves hang from a jewelled gold brooch on a gold cord at the throat, drape over the shoulders and flare a little past the pawn's base. The red field is the painted part. Working in from the edge, each half has a gold trim, a deep blue border (#2747a8) and a thin gold inner line. Each half also carries a gold diamond ornament with a blue centre and a gold stud above and below it, plus three gold tassels with blue knots along the hem. The head is left bare, and the pawn shows through the front opening, so a white or black pawn is still easy to tell apart.

I checked it on white and black pawns, at 60 px, at the 130 px home size, on its tile, and in every colour scheme at 75% purity, 100% and shiny. The renders gave no warnings.

**Motion:** 10 frames of 280 ms, a 2.8 s loop. It's one smooth, slow sway with no still pause:
- The hem swings about 2 units side to side; the middle of the cape moves half as much and the shoulders stay put.
- The two bottom edges each ripple up and down by about 1 unit, out of step with each other.
- The tassels swing about 9° and lag behind the hem, one after another along it, so they trail the cape.

**Choices you might want to change:**
- **Border colour:** the border is Alfil's blue except where blue fights the field. On cobalt it switches to a darker shade of the field. On midnight, a darker shade would be nearly black, so I used a deep crimson (#9e2433) instead. Your brief only offered a darker shade, so this is a judgement call.
- **Front opening:** the cape is open at the front so the pawn's colour shows. You could close it into a single panel if you'd rather have more painted area.
- **Name text:** the description reads "Woven for a mammoth, taken in for a pawn. Still has some room in the shoulders."
