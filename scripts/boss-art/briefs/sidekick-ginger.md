# Ginger's sidekick: a little gingerbread kid with a candy-cane scarf (a town bot)

Draw a **little gingerbread kid**: Ginger's sidekick. Ginger is the game's Freeze boss, an angry gingerbread man with white icing trim, a green bow tie, red gumdrop buttons and a big candy cane he holds like a weapon (read `packages/app/src/characters/gingerbread.ts`: the look, the palette
and how it's built). The sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: a friendly, curious kid who copies the big one.

## The look
- A small gingerbread kid, clearly a child: a big round head, big friendly icing eyes, a small happy icing smile, rosy cheeks, stubby arms and legs, a round little body. Cute and readable first.
- **Distinct from Ginger**, not a small copy: friendly, not angry (no scowl, no frosty glare), no big candy cane weapon, softer and rounder. Its link to him: his browns and white icing (borrow from `GINGER_PALETTE`), a gumdrop button or two, and **a red-and-white candy-cane-striped scarf** whose ends flutter.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Ginger's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it bobs gently, blinks, its scarf's ends flutter a little.
- **walk** (loops, about 0.6 s): a stiff, bouncy little cookie step, head bobbing, the scarf swinging.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it waves a stubby arm hello, the scarf flicking up (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Ginger (`gingerbread`) before calling done. It should
read at a glance as a little gingerbread kid in a candy-cane scarf, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
