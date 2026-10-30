# Moo's sidekick: a little calf with a star (a town bot)

Draw a **tiny calf**: Moo's sidekick. Moo is the game's cow boss: a round, soft Holstein calf, cream with dark-brown patches, a pink snout, floppy ears, small tan horns, standing on his hind legs hugging a crescent moon (read `packages/app/src/characters/moo.ts`: the look, the palette
and how it's built). The sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: a friendly, curious kid who copies the big one.

## The look
- A very small Holstein calf, clearly a baby: a big round head, big shiny eyes, a pink snout, floppy ears, no horns yet (just a cream tuft), cream with a few dark-brown patches, a round body, four little legs and a thin tail. Cute and readable first.
- **Distinct from Moo**, not a small copy: smaller, on all four legs, no moon. Its link to him: his cream, browns and pink (borrow from `MOO_PALETTE`) and **a little yellow star** (the Moon's friend) that it carries in its mouth or wears on a ribbon round its neck, twinkling now and then.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Moo's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it sways gently, blinks, flicks an ear and its tail, the star twinkles now and then.
- **walk** (loops, about 0.6 s): a wobbly little calf trot, head bobbing, the star swinging.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it lifts its head and the star twinkles brightly (a happy hello), then settles (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Moo (`moo`) before calling done. It should
read at a glance as a tiny calf with a little yellow star, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
