# Boss art (rider): birdie-train-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 3 renders.
- Spend: **$0.64** of the $3 cap (18 input, 51,654 cache-write, 212,987 cache-read, 17,080 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/birdie-train-ride/birdie-train-ride.tsx.
- Previews: scripts/boss-art/out/birdie-train-ride/preview/idle.png, scripts/boss-art/out/birdie-train-ride/preview/move.png, scripts/boss-art/out/birdie-train-ride/preview/look.png. Each look it took: scripts/boss-art/out/birdie-train-ride/looks/.

## Its notes

I've drawn Birdie's Train in side view only. I checked it at 4x and town size, with white and black pawns and in every color, and the pawn clearly sits in the cab. There are no front or back views and no trail mark, because the brief didn't ask for them.

What it is: Birdie's little yellow diesel, long and low (about 4:1), facing right. The pawn sits in an open hatch in the middle of a flat dark roof. A sloped windshield is in front of it, and the yellow side hides the pawn's lower part. The nose is rounded, with a round glowing headlight and grille slats. A thin red stripe runs along the body and sweeps up round the nose. There's a small stack at the back of the roof, two grey wheel trucks with four-spoke wheels, a red tail lamp and a rear buffer. There are no letters or numbers.

Painted part: only the yellow body, which is also the cab's sides, so the Yellow color matches his train. The roof, stripe, headlight, windshield, trucks, wheels and stack keep fixed colors.

Idle (12 frames x 150 ms): the body rocks gently on its springs and the headlight glow slowly brightens and dims. The wheels stay still. In the second half, a small puff rises from the stack, drifts up and fades near the train.

Move (10 frames x 65 ms, dx 0 to 100): it starts softly, rolls through the middle and slows to a soft stop. The wheels turn three-quarters of a turn, and since the spokes repeat every quarter turn, the last frame leads straight into the next move's first. The body bobs and rocks a little on the rails, and a puff comes from the stack in the first five frames as it sets off. The puff travels with the train, so nothing is left behind.

Choices you might want to change:
- Tier: the format requires one, so the file says "legendary" as a placeholder for the director to change.
- "Dark roof over the cab": I made it the train's flat dark roof with the hatch cut into it. I left out a canopy over the pawn, because that would make the tall cab the brief rules out.
- Wheel speed: the wheels turn less than real rolling would need, so the spokes read clearly at this frame rate instead of seeming to spin backwards.
- Midnight color: the dark roof blends a bit into a Midnight body. The outlines still separate them.
- Description: "A little yellow diesel that always runs on time. The tracks are imaginary; the punctuality is not."
