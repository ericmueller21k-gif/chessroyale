# Boss art (rider): birdie-train-ride

- Model claude-opus-5-5, effort high, adaptive thinking. 12 turns, 4 renders.
- Spend: **$0.75** of the $6 cap (26 input, 46,733 cache-write, 305,522 cache-read, 22,998 output tokens).
- Finished: it called done.
- The drawing: scripts/boss-art/out/birdie-train-ride/birdie-train-ride.tsx.
- Previews: scripts/boss-art/out/birdie-train-ride/preview/idle.png, scripts/boss-art/out/birdie-train-ride/preview/move.png, scripts/boss-art/out/birdie-train-ride/preview/look.png. Each look it took: scripts/boss-art/out/birdie-train-ride/looks/.

## Its notes

Birdie's Train is drawn: your pawn rides in the open cab of a little yellow toy diesel, facing right. It has a dark arched roof on two posts (the front one is a sloped windshield with a thin glass edge), a rounded hood and nose, two round headlights, a small exhaust stack on the hood, a thin red stripe that runs along the body and sweeps down the nose, a dark footplate, a grey cowcatcher, and two grey trucks with two wheels each. Each wheel has a crank pin and a counterweight, and the two wheels on a truck are joined by a side rod. The pawn sits with roughly its lowest third hidden behind the cab side (pawnX -14, pawnY -10, cut 66), its head well under the roof. There are no letters or numbers anywhere. I only drew the side view; there are no front or back views and no trail mark yet, because the brief didn't ask for them.

**What takes the item's color:** the hood, the cab side, both cab posts, and the far cab wall seen behind the pawn (a darker shade of the item color). Fixed colors: the dark roof (#34303f), the red stripe (#d8343a), the cream headlights with their yellow glow, the grey trucks and wheels, the dark footplate and the white puffs.

**Idle (12 frames × 150 ms):** the body rocks gently on its springs, with a small bob and about 0.6° of tilt, and the pawn rocks with it. The wheels stay still. The headlights' glow slowly brightens and dims. In frames 6–11 a puff comes out of the stack, rises, grows and fades just above the train.

**Move (10 frames × 65 ms, dx 0 to 100):** it starts and stops softly. The wheels turn exactly two full turns each square, so the next square's move carries on without a jump. The train leans back as it speeds up and dips its nose as it brakes, with a small rail bob. A puff comes out of the stack as it sets off (frames 0–4) and trails back a little, staying with the train. It eases to a stop at the end.

**Choices you might want to change:**
- The brief says the puff comes "from the roof". The cab roof sits right against the limit of how high an item can go, so I put the puff on a small stack on the hood just in front of the cab instead.
- The tier is set to "legendary" only as a placeholder, because the format requires one; the director decides the real tier.
- On a red item the red stripe nearly disappears, and on midnight the roof is close to the body color (its highlight line still sets it apart).
- The description reads: "A little yellow diesel that runs on time, mostly. The whistle is sold separately, thank goodness."
