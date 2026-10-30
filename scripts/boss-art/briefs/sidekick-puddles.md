# Puddles's sidekick: a baby hippo with a watering can (a town bot)

Draw a **baby hippo**: Puddles's sidekick. Puddles is the game's hippo gardener boss: an upright hippo with a heavy barrel body, a big square muzzle, small round ears, pinkish-grey skin with a pinker belly, holding a garden hose with a brass-and-green nozzle (read `packages/app/src/characters/gardener.ts`: the look, the palette
and how it's built). The sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: a friendly, curious kid who copies the big one.

## The look
- A small, round baby hippo, clearly a baby: a big round head with a wide soft muzzle and two nostrils, big friendly eyes, small round ears, pinkish-grey skin with a pinker belly and cheeks, a round body and short stubby legs. Cute and readable first.
- **Distinct from Puddles**, not a small copy: smaller and rounder, no hose. Its link to him: his skin colors (borrow from `GARDENER_PALETTE`) and **a little green watering can** held in its arms or one hand, a few drops falling from its spout now and then, and maybe a small sprout or flower stuck behind one ear.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Puddles's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it sways gently, blinks, wiggles its ears, now and then the can drips a drop or two.
- **walk** (loops, about 0.6 s): a heavy, waddly little step, head bobbing, the can held close.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it lifts the watering can and sprinkles a little arc of drops (a happy hello), then settles (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Puddles (`gardener`) before calling done. It should
read at a glance as a baby hippo with a little watering can, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
