# Boss art: token-hollow

- Model claude-opus-5-5, effort high, adaptive thinking. 8 turns, 4 renders.
- Spend: **$0.51** of the $1 cap (18 input, 32,388 cache-write, 141,165 cache-read, 16,167 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-hollow/token-hollow.ts.
- Previews: scripts/boss-art/out/token-hollow/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-hollow/looks/.

## Its notes

I've drawn token-hollow: a 40 x 40 coin with a transparent background, meant to be shown at 2x. I checked it at 6x on dark and light backgrounds and at phone size; the gold eyes are the first thing you see at 1x and 2x.

**Coin:** the disc, rim, rivets, dark inner ring, navy middle, gold halo (#ffe08a33), glint code and timings are copied unchanged from token-blitz. Only the face layers are new.

**Face:**
- **Head:** a shaggy, spiky charcoal head using Hollow's own fur colors, lit from the top left, with darker strands scattered through the fur. The top spikes are cut off by the inner ring.
- **Eyes and mouth:** narrow gold eyes slanting in for a glare, heavy brows, a small nose and a thin mouth with two pale fangs.
- **Seam:** a torn seam across his left cheek (our right), in bright violet over violet-black, with pale stitches crossing it.
- **Edge glow:** a thin violet outline outside the dark outline, so he doesn't vanish on the navy.
- **Lights:** a loop of his Christmas lights sags across his shoulders with five bulbs (red, gold, blue, red, gold), each with a white glint.

**idle**, as Blitz's:
1. Four frames of 180 ms each: the glint travels round the rim a quarter turn per frame, starting at the top left.
2. A 1400 ms rest.
3. A 150 ms blink: the gold goes out and a dark lid line is left where the eyes were.

Nothing else moves.

**Choices you might change:**
- **Bulbs:** they're 2x2 so they fit inside the round navy middle. The two outer bulbs sit high on the wire, right at the inner ring. You could cut it to three bulbs, or make them bigger.
- **Seam:** it starts just under the right eye. At 1x it can read a little like a violet tear. It could move lower on the cheek.
- **Glow:** I drew it as a solid violet line with darker corner pixels, so it's a bold outline rather than a soft glow.
- **Bulb colors:** I picked fixed red, gold and blue shades for the token myself. They don't follow the battle's random lights the way his in-game strand does.
