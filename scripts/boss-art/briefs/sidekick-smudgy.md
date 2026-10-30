# Smudgy's sidekick: a baby chameleon with a paintbrush (a town bot)

Draw a **baby chameleon**: Smudgy's sidekick. Smudgy is the game's chameleon painter boss: a lime-green chameleon with a casque striped orange, teal and green, the same patchy stripes on his limbs and spiral tail, big amber turret eyes, a plum beret, a paint-splashed apron, a big dripping brush and a palette (read `packages/app/src/characters/smudgy.ts`: the look, the palette
and how it's built). The sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: a friendly, curious kid who copies the big one.

## The look
- A small lime-green baby chameleon, clearly a baby: a big round head with a small casque, big amber turret eyes that look around, a small friendly smile, a round body, little gripping feet and a curled spiral tail. Cute and readable first.
- **Distinct from Smudgy**, not a small copy: smaller and rounder, no apron, no palette, no beret. Its link to him: a few of his orange and teal stripes (borrow from `SMUDGY_PALETTE`) and **a small paintbrush** held in one hand, a dab of paint on its tip (and a paint smudge on its cheek).
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Smudgy's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it bobs gently, its turret eyes roll about and blink, its tail curls and uncurls.
- **walk** (loops, about 0.6 s): a careful little step-and-grip walk, head bobbing, the brush held up.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it waves the paintbrush hello, a tiny dab of paint flicking off, then settles (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Smudgy (`smudgy`) before calling done. It should
read at a glance as a baby chameleon holding a paintbrush, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
