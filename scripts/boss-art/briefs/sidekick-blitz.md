# Blitz's sidekick: a tiny, very slow tortoise with his chess clock (a town bot)

Draw a **tiny tortoise**: Blitz's sidekick. Blitz is the game's new boss, a cocky speed-chess cheetah in a backwards cap
and a teal and orange zip jacket, slapping a white chess clock with a red flag (read
`scripts/boss-art/out/boss-blitz/boss-blitz.ts`: his look, palette and how he's built; the reference picture shows him).
The sidekick is a **bot that walks around the town square** and plays chess with people at the park's tables. It has
no powers and never fights. The joke: fast guy, slow buddy.

**Never base it on, name or hint at a real person.** No letters or numbers anywhere (the clock shows ticks, never numerals).

## The look
- A small, round, very slow **tortoise**: a domed shell with a few chunky plates, a wrinkly head on a stretchy neck,
  heavy-lidded sleepy eyes, a deadpan flat mouth, stubby legs. Cute and readable first.
- **Blitz's chess clock rides on its shell** (the same white clock with two faces, two buttons and the red flag, ticks
  only, borrowed from Blitz's palette), maybe strapped on. Maybe a tiny teal-and-orange touch (a sweatband or a little
  cap) tying it to Blitz. Sleepy and deadpan, never sad.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the
  palette's `k`), whole pixels, true pixel art.
- **Size:** low and wide, about 40 to 50% of Blitz's height; a frame about 40 to 56 pixels tall, feet near the bottom.
  Big, simple shapes: at phone size the shell, the sleepy face and the clock must read.

## The animations (a few frames each; whole pixels)
Like the finished sidekicks (`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts` and
`packages/app/src/characters/sidekicks/`):
- **idle** (loops, about 3 to 4 s): almost still: a slow breath, a very slow blink, its head drooping as it nods off,
  then jerking awake a pixel; the clock's flag twitches once.
- **walk** (loops, slow, about 1 to 1.2 s): a ponderous plod, one stubby foot at a time, head bobbing, the clock wobbling.
- **sit** (loops): at a chess table, seen from the side it faces the board (our right): settled on its belly or a stool,
  half-asleep over the board, a very slow blink, now and then it reaches out and slowly presses the clock's button.
- **wave** (plays once, about 1.5 s; its reaction when tapped): it slowly raises one stubby foot, gives a sleepy wave
  and a tiny deadpan smile, then the clock dings (a little spark on the button) and it settles back to idle.

## Quality bar
Look at each animation at 4x and the idle at phone size beside another character before calling done. It should read at
a glance as a sleepy tortoise carrying a chess clock, and look like it belongs in the same game as Jefferson's sidekick
(match its size, outline weight and level of detail). Clean, cute and readable beats intricate.
