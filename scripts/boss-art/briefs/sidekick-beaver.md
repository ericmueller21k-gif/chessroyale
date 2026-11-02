# Timber's sidekick: a woodpecker foreman in a tiny hard hat (a town bot), Nov 1

Draw a **little woodpecker foreman**: the sidekick of Timber, the game's new beaver builder boss. Timber is a stout brown
beaver in an orange hard hat and orange safety vest, a yellow tool belt (red-handled hammer, tape measure, wrench,
pouches), two crossed planks on his back and a crosshatched paddle tail (read
`scripts/boss-art/out/boss-beaver/boss-beaver.ts` for the look, the palette and how it's built; the reference pictures
show him at phone size beside the tiger, and Eric's reference). The sidekick is a **bot that walks around the town
square** and plays chess with people at the park's tables. It has no powers and never fights: a busy, bossy-but-friendly
little foreman.

## The look
- A small, round woodpecker, cute and readable first: a red crest showing under or behind its hat, black-and-white
  wings, a pale belly, big shiny eye, a **strong pointed beak** (its tool).
- **A tiny orange hard hat of its own** (Timber's orange, borrowed from his palette), maybe a tiny orange vest stripe or
  sash to tie it to him. Distinct from Timber: not a small copy.
- **A short plank or a stack of two little planks** it stands by or carries now and then, to tap on with its beak.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the
  palette's `k`) like every other character, whole pixels, true pixel art. Never letters or numbers.
- **Size:** about 60% of Timber's height at most; a frame about 48 to 64 pixels tall, feet near the bottom. Big, simple
  shapes: at phone size its hat, crest, eye and beak must read.

## The animations (a few frames each; whole pixels)
The same set as every finished sidekick (`packages/app/src/characters/sidekicks/*.ts`: idle, walk, sit, wave, entrance,
thinking, move, capture, hurt, check, smug, rattled, defeat, victory). The first four matter most; do them first and
best:
- **idle** (loops, about 3 s): it bobs, blinks, and now and then **taps on its plank with its beak** (rat-a-tat, a few
  quick pecks with tiny wood chips, cue `tap`), then nods, satisfied, and pushes its little hat straight.
- **walk** (loops, about 0.6 s): a quick bird hop-step, head bobbing, tail feathers flicking.
- **sit** (loops): perched on a stool at a chess table, facing the board (our right), feet dangling, a slow blink, a
  thoughtful little peck at the air now and then.
- **wave** (plays once, about 1.2 s; the reaction when you tap it): a happy wing wave, the hat wobbling, a quick
  rat-a-tat hello peck, then it settles back to its idle pose.
- The rest briefly, in character (a foreman: points with its wing like giving orders, a smug crest-flare, a dizzy hat
  over its eyes on defeat, hopping with joy on victory).

## Quality bar
Look at each animation at 4x and the idle at phone size beside another boss before calling done. It should read at a
glance as a little woodpecker in a tiny orange hard hat, and look like it belongs in the same game as Jefferson's
sidekick (`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked:
match its size, outline weight and level of detail). Clean, cute and readable beats intricate.
