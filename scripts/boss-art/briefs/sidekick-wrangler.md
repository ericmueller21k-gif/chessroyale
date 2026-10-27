# Wrangler's sidekick: a little piglet in a cowboy hat (a town bot)

Draw a **little piglet cowpoke**: Wrangler's sidekick. Wrangler is the game's cowboy pig boss: a pink pig in a wide fighting crouch with a brown cowboy hat, a gold star, a fringed vest, a big belt buckle, boots with spurs and a spinning lasso (read `packages/app/src/characters/pig.ts`: the look, the palette
and how it's built). The sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: a friendly, curious kid who copies the big one.

## The look
- A small pink piglet, clearly a baby: a big round head, big friendly eyes, a round snout, little pointy ears, a curly tail, a round body and stubby legs. Cute and readable first.
- **Distinct from Wrangler**, not a small copy: friendly, not scheming (no angry brows, no toothy grin, no fighting crouch). Its link to him: **a brown cowboy hat a little too big for it** with a small gold star (borrow from `PIG_PALETTE`), a tiny red bandana, and **a short toy rope** coiled in one hoof.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Wrangler's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it bobs gently, blinks, its curly tail wiggles, it tips its hat back now and then.
- **walk** (loops, about 0.6 s): a bouncy little trot, head bobbing, the hat wobbling.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it tips its hat hello, then settles (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Wrangler (`pig`) before calling done. It should
read at a glance as a little piglet in a cowboy hat, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
