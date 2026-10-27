# Hollow's sidekick: a little shadow critter with one glowing bulb (a town bot)

Draw a **little shadow critter**: Hollow's sidekick. Hollow is the game's Darkness boss, a lanky, shaggy creature of charcoal-black fur with glowing gold eyes, a swirling band of violet darkness through his middle, and a strand of Christmas lights (read `packages/app/src/characters/hollow.ts`: the look, the palette
and how it's built). The sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: a friendly, curious kid who copies the big one.

## The look
- A small, round, fluffy creature of charcoal fur, clearly a baby: a big round head with big glowing gold eyes (friendly, wide and curious), tiny ears, a small happy mouth, a round fuzzy body and stubby legs. Cute and readable first.
- **Distinct from Hollow**, not a small copy: sweet, not scary (no torn seams, no void, no band of darkness), round rather than lanky. Its link to him: his charcoal fur and violet edge glow (borrow from `HOLLOW_PALETTE`) and **one Christmas light bulb on a short bit of wire** that it carries like a lantern, glowing softly (the battle's colors: red, gold or blue; pick one).
- It must never vanish on the dark ground at night: keep a thin violet edge glow like Hollow's.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Hollow's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it bobs gently, blinks its big glowing eyes, the bulb's glow pulses softly.
- **walk** (loops, about 0.6 s): a soft, fluffy hop-step, head bobbing, the bulb swinging a little.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it lifts the bulb and waves hello, the bulb glowing brighter for a moment (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Hollow (`hollow`) before calling done. It should
read at a glance as a little fluffy shadow critter carrying a glowing Christmas bulb, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
