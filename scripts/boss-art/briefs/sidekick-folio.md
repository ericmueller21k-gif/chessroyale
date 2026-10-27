# Folio's sidekick: an origami frog (a town bot)

Draw an **origami frog**: Folio's sidekick. Folio is the game's paper crane boss: a crane folded from a page of handwriting (faded blue ink lines on cream paper, crisp folds, a small red seal), calm and literary (read `scripts/boss-art/out/folio/folio.ts`: the look, the palette and how it's built). The
sidekick is a **bot that walks around the town square** and plays chess with people at the park's tables. It has no powers
and never fights: a friendly, curious little one who copies the big one.

## The look
- A small origami frog, folded from the same handwritten paper as Folio: cream paper with faint blue lines of writing, crisp angular folds and facets lit from the top left, two simple round dark eyes (drawn or folded bumps), a wide happy mouth line, folded back legs ready to hop. Cute and readable first: a frog shape at a glance.
- **Distinct from Folio**, not a small copy: a frog, not a bird. Its link to Folio: the same paper, ink and fold shading (borrow Folio's palette from its drawing), and **a tiny red seal** on its back like Folio's.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** a frame about 48 to 64 pixels tall, feet near the bottom, about the size of the other sidekicks. Big, simple
  shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it sits and breathes (its paper body flexes a little), blinks, now and then a tiny paper crinkle.
- **walk** (loops, about 0.6 s): it hops: a squash, a hop forward, a landing with a flat little paper flutter.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling or
  tucked, its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it lifts one front foot hello (or does a happy little hop in place), then settles (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Boingo (`clown`), for size, before calling done. It should read at a glance as
an origami frog folded from handwritten paper, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
