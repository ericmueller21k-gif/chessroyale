# Babur's sidekick: a tiger cub hugging a big purple balloon (a town bot)

Draw a **tiger cub**: Babur's sidekick. Babur is the game's circus tiger boss: a big orange tiger with black stripes, a cream chest, a small black top hat with a red band, a red and gold ringmaster's vest, holding the strings of four chess-piece balloons (a red queen, a blue knight, a green rook and a purple pawn) (read `packages/app/src/characters/tiger.ts`: the look, the palette and how it's built). The
sidekick is a **bot that walks around the town square** and plays chess with people at the park's tables. It has no powers
and never fights: a friendly, curious little one who copies the big one.

## The look
- A small, round tiger cub, clearly a baby: a big round head, big amber eyes, a cream muzzle and chest, round ears, a few soft black stripes, big paws and a short striped tail. Cute and readable first.
- **Distinct from Babur**, not a small copy: smaller and rounder, no vest, no top hat (or a tiny one tipped over one ear). Its
  link to him is a balloon, but not his chess-piece ones: **a big, plain, round purple balloon** (an ordinary party balloon:
  shiny, one soft highlight, a little knot at the bottom and a short string), **almost as big as the cub's body**.
- **It hugs the balloon like its stuffed animal (Eric):** both front legs wrapped round it, its cheek pressed against it,
  squeezing it now and then so the balloon squishes in where it's held and bulges out round its arms, then springs back.
  Babur pops balloons; his cub is too little to have claws yet, so this one never pops. Show it, never say it: the paws are
  plainly soft and round, no claws drawn anywhere, and the squeezes look happy and cozy.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** a frame about 48 to 64 pixels tall, feet near the bottom, about the size of the other sidekicks. Big, simple
  shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it sits or stands hugging the balloon, sways gently, blinks, its tail swishes, and once a loop gives it a big happy squeeze (the balloon squishes in and bulges out round its arms, then springs back).
- **walk** (loops, about 0.6 s): a waddly little trot on its back legs, still hugging the balloon to its chest, head bobbing.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling or
  tucked, the balloon held in its lap like a stuffed animal, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it peeks round the balloon and waves one paw hello while the other arm keeps hugging it (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Babur (`tiger`) before calling done. It should read at a glance as
a tiger cub hugging a big purple balloon like a stuffed animal, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
