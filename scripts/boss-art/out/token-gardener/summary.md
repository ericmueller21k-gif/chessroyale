# Boss art: token-gardener

- Model claude-opus-5-5, effort high, adaptive thinking. 7 turns, 3 renders.
- Spend: **$0.35** of the $1 cap (16 input, 23,953 cache-write, 82,737 cache-read, 10,558 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-gardener/token-gardener.ts.
- Previews: scripts/boss-art/out/token-gardener/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-gardener/looks/.

## Its notes

I've drawn the Puddles token. It's 40 × 40 with a transparent background, meant to show at 2x. I checked it at 4x and up close on both the dark and light backgrounds, and at phone size, where it reads as a hippo at a glance.

**The coin** is copied unchanged from token-blitz: gold rim lit from the top left, rivets, dark inner ring, navy middle (with the lighter navy band at the bottom), `k` outline, faint gold halo and the same glint code. Only the face parts are new.

**The face** fills the navy middle the way Ginger's and Blitz's do, centred, head and shoulders only:
- a rounded mauve dome with small round ears that are pink inside;
- small dark eyes set high, each with a white glint;
- pink cheeks at the sides;
- a big square greyer-mauve muzzle with two nostrils on top and a soft smile turned up at both ends, with a hint of pink lower lip under it;
- bare shoulders with a pink throat and chest. He wears no clothes.

**The emblem:** at our left his fist holds the green-gripped, brass-tipped hose nozzle upright beside his cheek. Five loose water drops float above it, and the hose hangs down out of the coin. All colours come from gardener.ts.

**Idle**, beat by beat (2270 ms, loops):
1. Four frames of 180 ms each: the glint goes round the rim a quarter turn at a time, starting at the top left.
2. A 1400 ms rest.
3. A 150 ms blink: each eye becomes a dark line under a lid of skin.

The water drops are drawn in every frame and don't move. Nothing else moves.

**Choices you might change:**
- The nozzle is on our left, the side he sprays toward in his boss art. It could go on the right instead.
- The water drops stay still. They could flicker or rise if you want more life, but the brief said nothing else moves.
- The muzzle is the widest shape on purpose, so he reads as a hippo rather than a pig. It could be made even wider or squarer.
- The drops at the top left sit near where the glint starts, so in that first frame they briefly overlap.
