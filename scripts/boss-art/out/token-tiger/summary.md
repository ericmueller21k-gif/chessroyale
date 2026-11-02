# Boss art: token-tiger

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 2 renders.
- Spend: **$0.45** of the $1 cap (20 input, 27,947 cache-write, 110,522 cache-read, 14,367 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-tiger/token-tiger.ts.
- Previews: scripts/boss-art/out/token-tiger/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-tiger/looks/.

## Its notes

The Babur token is finished, in scripts/boss-art/out/token-tiger/token-tiger.ts, exported as TOKEN_TIGER (id "token-tiger", name "Babur token"). I rendered all six idle frames on dark and on light backgrounds, and looked at it at phone size (1x and 2x).

Size: 40 x 40, transparent background, meant to be shown at 2x. It still reads as a tiger in a top hat at 1x.

The coin is copied unchanged from the Blitz token: the gold rim with its rivets, the dark inner ring, the navy middle (lighter below), the k outline and the faint gold halo. Only the face is new.

The face (head and shoulders, centered, about the size of Blitz's and Ginger's): an orange tiger head lit from the top left, with black stripes on the forehead, the sides and the cheeks; fluffy cream cheeks and a cream muzzle with a pink nose and a small "w" mouth; calm half-lidded amber eyes with dark slit pupils, white marks over the eyes and dark lines from their inner corners; short pale whiskers poking past the cheeks; round ears, cream inside; his small black top hat with its red band, tipped to our right; and the red ringmaster's vest at the shoulders, with gold edging, gold buttons and his cream chest fur in the V.

Idle, beat by beat (as Blitz's): the glint travels a quarter turn round the rim per frame, starting at the top left (4 frames of 180 ms each), then a 1400 ms rest, then a 150 ms blink. Nothing else moves.

Choices you might want to change:
- Balloon: one small blue pawn balloon on its string, left of the head. There's so little room that it's only about 4 x 7 pixels, so at 1x it reads as a blue balloon more than as a clear pawn. It can be removed (the face stays centered) or recolored; I chose blue to stand apart from the red vest.
- Hat: tipped to our right and a little off center. It could sit straight in the middle instead.
- Head width: about 2 pixels narrower than the cheetah's on the Blitz token, to leave room for the balloon. Without the balloon it could be widened to match.
- The gold buttons are faint at phone size.
