# Boss art: sidekick-folio

- Model claude-sonnet-5-5, effort xhigh, adaptive thinking. 48 turns, 59 renders.
- Spend: **$4.21** of the $20 cap (98 input, 345,100 cache-write, 9,179,099 cache-read, 151,316 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/sidekick-folio/sidekick-folio.ts.
- Previews: scripts/boss-art/out/sidekick-folio/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/sidekick-folio/looks/.

## Its notes

Folio's sidekick is done: scripts/boss-art/out/sidekick-folio/sidekick-folio.ts, id "sidekick-folio", export `sidekickFolio`. It has all 14 animations and I looked at every one at 3 to 6x. The idle sits beside Boingo and the tiger at phone size. No frame-edge warnings on any animation. I did not run a typecheck or the game; I only rendered it.

**The look:** a squat origami frog on Folio's paper and palette, facing our right. It has cream faces lit from the top left, faint blue handwriting lines, a red seal on its back, and a big flat head with two round paper-bump eyes. The front foot holds one prop, a small red paper pawn (the same shape as the pawn knocked out of Folio's seal). The hind leg is a pyramid-folded haunch with a flat foot, so the silhouette shows a pointed folded leg at the back.

**Frame and size:** the frame is 68×64, 4 px wider than Jefferson's sidekick, so the raised pawn and the tongue don't hit the right edge. The frog itself is about 50×48 and smaller than Boingo, as a sidekick should be.

**Animations, beat by beat:**
- **idle** (3 s, loops): breathes (body flexes a pixel, pawn lifts), throat flutters, blinks twice, glances toward the board, and a tiny crease flashes on the haunch.
- **walk** (0.57 s, loops): crouch, push off with the mouth opening, stretched in the air with the hind leg trailing, tuck, squashed landing with a flutter of paper bits, recover.
- **sit** (3.2 s, loops): on a wide stool, one leg dangling and swinging, pawn low in its lap, slow blinks, leans in to think.
- **wave** (1.1 s): small hop, lands, pawn held high and waved four times with a happy grin and a croak, then back to rest.
- **entrance:** a loose page drifts down rocking, lands flat, folds into a corner-up square, pops into the frog in a puff of paper bits, hops, and waves hello.
- **thinking** (loops): head tipped up, eyes rolled up, fist under the chin, pawn stood on the ground, toe tapping, thought dots and an ink "?".
- **move:** crouch, hop toward the board, pawn pressed down with a spark, then picked back up.
- **capture:** tongue flicks out and snatches a small cream paper piece, reels it in, gulps (pink throat puff), then hops for joy with the pawn high.
- **hurt:** flash, "> <" eyes, a crease and sweat drops, the pawn flung out of its foot; it catches it, blinks, and shakes it off.
- **check:** two pawn jabs at the board with bold eyes, a croak (throat puffs), an ink "!"; ends smug.
- **smug** (loops): chin up, half-lidded eyes (they read like little sunglasses), smirk, slow nod, one glint.
- **rattled** (loops): wide eyes with pinpoint pupils, wavy mouth, sweat drops, trembling.
- **defeat:** hit, dizzy X eyes and tongue out, pawn flung away, deflates and flops flat, folds into a square, then settles into a flat page with the seal. The pawn stands beside it, and the writing fades; the last frame holds.
- **victory** (loops): hops for joy waving the pawn, croaks, paper bits and sparkles.

**Choices you might change:**
- **Prop:** it carries a red paper pawn. A quill or a tiny paper crane would also fit. Changing it is one 8-row grid, `PAWN`.
- **Tongue snap:** capture eats a piece with a tongue flick, which is more frog than Folio's polite tuck. It's easy to swap for a plain double hop.
- **Loop flags:** I copied Jefferson's sidekick, so smug, rattled and victory loop and wave, entrance, move, capture, hurt, check and defeat play once.
- **Extra colors:** a soft pink for the blush and throat puff, and a pale blue for sweat.
