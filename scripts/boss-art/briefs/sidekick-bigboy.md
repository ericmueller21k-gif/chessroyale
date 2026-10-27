# Big Boy's sidekick: a toddler teddy bear with a toy block (a town bot)

Draw a **toddler teddy bear**: Big Boy's sidekick. Big Boy is the game's baby boss, a chubby bald baby in a teal "BIG BOY" crop shirt and a light blue diaper, with a swirly rainbow lollipop, who throws toy blocks at the board (read `packages/app/src/characters/bigboy.ts`: the look, the palette
and how it's built). The sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: a friendly, curious kid who copies the big one.

## The look
- A small, plush teddy bear, clearly a toy come to life: a big round head with round ears, button eyes with a shine, a stitched smile, a round tummy, stubby arms and legs, a few visible stitches. Cute and readable first.
- **Distinct from Big Boy**: a teddy, not a baby (no diaper, no lollipop, no lettering). Its link to him: his teal and light blue (borrow from `BIGBOY_PALETTE`) in a small bib or bow, and **a toy block** (one letter-less colored cube) hugged or carried in its paws.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Big Boy's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it sways gently, blinks, hugs its block a little tighter now and then.
- **walk** (loops, about 0.6 s): a wobbly toddler waddle, head bobbing, the block held to its tummy.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it lifts one paw and waves hello, the block held in the other (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Big Boy (`bigboy`) before calling done. It should
read at a glance as a little teddy bear holding a toy block, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
