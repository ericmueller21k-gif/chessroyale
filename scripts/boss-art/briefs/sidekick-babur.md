# Babur's sidekick: a tiger cub with a balloon (a town bot)

Draw a **tiger cub**: Babur's sidekick. Babur is the game's circus tiger boss: a big orange tiger with black stripes, a cream chest, a small black top hat with a red band, a red and gold ringmaster's vest, holding the strings of four chess-piece balloons (a red queen, a blue knight, a green rook and a purple pawn) (read `packages/app/src/characters/tiger.ts`: the look, the palette and how it's built). The
sidekick is a **bot that walks around the town square** and plays chess with people at the park's tables. It has no powers
and never fights: a friendly, curious little one who copies the big one.

## The look
- A small, round tiger cub, clearly a baby: a big round head, big amber eyes, a cream muzzle and chest, round ears, a few soft black stripes, big paws and a short striped tail. Cute and readable first.
- **Distinct from Babur**, not a small copy: smaller and rounder, no vest, no top hat (or a tiny one tipped over one ear). Its link to him: his oranges and stripes (borrow from `TIGER_PALETTE`) and **one balloon on a string** held in a paw: a shiny purple pawn-shaped balloon like his (round, with a highlight), bobbing above its head.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** a frame about 48 to 64 pixels tall, feet near the bottom, about the size of the other sidekicks. Big, simple
  shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it bobs gently, blinks, its tail swishes, the balloon bobs on its string.
- **walk** (loops, about 0.6 s): a playful little pounce-trot, head bobbing, the balloon trailing above.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling or
  tucked, its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it waves its free paw hello, the balloon bouncing, then settles (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Babur (`tiger`) before calling done. It should read at a glance as
a tiger cub holding a purple pawn balloon, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
