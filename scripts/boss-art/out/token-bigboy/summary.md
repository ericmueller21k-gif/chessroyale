# Boss art: token-bigboy

- Model claude-opus-5-5, effort high, adaptive thinking. 10 turns, 5 renders.
- Spend: **$0.37** of the $1 cap (22 input, 24,188 cache-write, 135,507 cache-read, 10,985 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/token-bigboy/token-bigboy.ts.
- Previews: scripts/boss-art/out/token-bigboy/preview/ (GIFs, the frame sheet, the comparison). Each look it took: scripts/boss-art/out/token-bigboy/looks/.

## Its notes

The Big Boy token is finished in scripts/boss-art/out/token-bigboy/token-bigboy.ts and exported as TOKEN_BIGBOY (id "token-bigboy", name "Big Boy token"). The frame is 40 x 40 with a transparent background, meant to be shown at 2x. I rendered it at 4x and 8x on dark and light backgrounds and at phone size. It reads at a glance, and the render gave no warnings.

**The coin:** I copied the rim, rivets, dark inner ring, navy middle, halo, palette keys and glint code from the Blitz token unchanged. Only the face layers are new.

**The face:** Big Boy's colors come from BIGBOY_PALETTE. Some of his keys clash with the coin's, so I renamed them in this file only:
- lips: l, L, P, m
- hair: H
- shirt: T, t, u, U

The face fills the navy middle as Blitz's does:
- a chubby bald head, lit from the top left
- big ears; the left one is mostly hidden behind the lollipop
- half-lidded eyes under a heavy dark lid line, with thin brows
- a button nose and big pink lips with a dark line between them
- three thin brown hair tufts on top
- the teal crop shirt at his shoulders, with no letters
- the swirly rainbow lollipop with a white highlight, held up on our left beside his cheek, with its stick and his fist below

**Idle, beat by beat:**
1. The glint travels round the rim a quarter turn per frame, 4 x 180 ms, starting at the top left.
2. A 1400 ms rest.
3. A 150 ms blink: the lids close to a dark lash line.

Nothing else moves.

**Choices you might change:**
- The hair tufts have no outline and are faint on the navy. I left them subtle so they read as wispy strands rather than a cap; they could be given an outline or a lighter brown.
- The head sits one pixel right of center so the lollipop has room on the left.
- Two lighter skin patches on the cheeks give it chubbiness; they could become a pink blush instead.
