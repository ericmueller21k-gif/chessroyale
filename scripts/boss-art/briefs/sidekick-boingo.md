# Boingo's sidekick: a little clown with a squirting flower (a town bot)

Draw a **little clown kid**: Boingo's sidekick. Boingo is the game's clown boss, a grinning harlequin with red eyes on a
pogo stick, always bouncing (read `packages/app/src/characters/clown.ts`: his look, his palette and how he's built). His
sidekick is a **bot that walks around the town square** and plays chess with people at the park's tables. It has no powers
and never fights: a cheerful, mischievous kid who copies the big guy's act.

## The look
- A small clown kid, clearly a child: a big round head with big friendly eyes, a red ball nose, rosy cheeks, a small happy
  smile, a tuft or two of curly hair, a short round body in a baggy clown suit, big floppy shoes. Cute and readable first.
- **Distinct from Boingo**, not a small copy: friendly, not creepy (no red eyes, no wide sharp grin, no face paint mask),
  **no pogo stick** (it walks), softer and rounder. Its link to him: his colors (his red, purple and gold: borrow from
  `CLOWN_PALETTE`), a pompom or two, and **a squirting flower** pinned to its chest or held in one hand, that squirts a
  little arc of water now and then.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Boingo's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, nose and flower must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it bobs gently, blinks, now and then the flower gives a tiny squirt.
- **walk** (loops, about 0.6 s): a bouncy little waddle in its big shoes, head bobbing.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its shoes swinging, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it waves hello and the flower squirts a little arc (a happy hello when you tap it),
  then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Boingo (`clown`) before calling done. It should read at a
glance as a little clown with a squirting flower, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
