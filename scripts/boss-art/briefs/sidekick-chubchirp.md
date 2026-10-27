# Chub & Chirp's sidekick: a baby bunny with a tiny grasshopper friend (a town bot)

Draw a **baby bunny**: Chub & Chirp's sidekick. Chub & Chirp are the game's rabbit-and-grasshopper boss: Chub, a brown rabbit with a cream chest, a green scarf with a gold clasp and a small satchel, riding Chirp, a big green grasshopper with a big black eye and long antennae (read `packages/app/src/characters/hopper.ts`: the look, the palette and how it's built). The
sidekick is a **bot that walks around the town square** and plays chess with people at the park's tables. It has no powers
and never fights: a friendly, curious little one who copies the big one.

## The look
- A small brown baby bunny, clearly a baby: a big round head, big shiny eyes, long floppy ears, a twitchy pink nose, a cream chest and cotton tail, a round body and big back feet. Cute and readable first.
- **Distinct from Chub & Chirp**, not a small copy: no saddle, no riding. Its link to them: their browns and greens (borrow from `HOPPER_PALETTE`), **a little green scarf**, and **a tiny green grasshopper friend** sitting on its head between its ears (a few pixels, but clearly a grasshopper: a green body and two antennae).
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** a frame about 48 to 64 pixels tall, feet near the bottom, about the size of the other sidekicks. Big, simple
  shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it bobs gently, blinks, its nose twitches, the tiny grasshopper on its head waves its antennae.
- **walk** (loops, about 0.6 s): a soft little hop-hop, ears bouncing, the scarf flicking.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling or
  tucked, its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it waves a paw hello and the grasshopper on its head does a tiny hop, then they settle (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Chub & Chirp (`hopper`) before calling done. It should read at a glance as
a baby bunny with a tiny grasshopper on its head, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
