# Alfil's sidekick: a woolly baby mammoth (a town bot)

Draw a **woolly baby mammoth**: Alfil's sidekick. Alfil is the game's woolly mammoth boss: a shaggy brown mammoth with big curved ivory tusks, a red and blue Nettipattam on his brow, a caparison with gold trim and tassels, and a gold goad (read `packages/app/src/characters/alfil.ts`: the look, the palette
and how it's built). The sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: a friendly, curious kid who copies the big one.

## The look
- A small, round, shaggy baby mammoth, clearly a baby: a big fluffy head, big shiny eyes, a short curly trunk, tiny stub tusks (just nubs), round ears, a round woolly body, four stubby legs. Cute and readable first.
- **Distinct from Alfil**, not a small copy: friendly, not fierce (no angry brows, no big tusks, no fighting stance on its hind legs: it stands on all four). Its link to him: his browns (borrow from `ALFIL_PALETTE`) and **a small red and blue cap with a gold tassel** on its head, like a little Nettipattam.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Alfil's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it sways gently, blinks, its trunk curls and uncurls, its tail flicks.
- **walk** (loops, about 0.6 s): a plodding little four-legged step, head bobbing, the tassel swinging.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it lifts its trunk and waves it hello (a tiny toot shape is fine), then settles (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Alfil (`alfil`) before calling done. It should
read at a glance as a woolly baby mammoth in a little red and blue cap, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
