# Jefferson's sidekick: a baby giraffe with a sparkler (a town bot)

Draw a **baby giraffe**: Jefferson's little sidekick. Jefferson is the game's Fire boss, a cocky giraffe with flaming
horn tips, a fiery mane and a sparkler in each hand (read `packages/app/src/characters/grex.ts`: his look, his palette and
how he's built). His sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: it's a friendly, curious kid who copies the big guy.

## The look
- A baby giraffe, clearly a baby: a big round head with big shiny eyes, short stubby ossicones (little horns), a short
  neck for a giraffe (still longer than anyone else's), a round little body and knobbly legs. Cute and readable first.
- **Distinct from Jefferson**, not a small copy: softer and rounder, paler yellow with fewer, rounder spots, no flames on
  its horns, mane or tail (a small plain tuft instead), no fighting stance. Its one link to him: **a single small sparkler
  in one hoof**, held up proudly, spitting a few sparks.
- Three-quarter view, facing our right (as Jefferson faces), light from the top left, a dark outline (the palette's `k`)
  like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Jefferson's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and sparkler must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it bobs gently, blinks, the sparkler fizzes (a few seeded sparks each frame).
- **walk** (loops, about 0.6 s): a short trotting step on its knobbly legs, head bobbing, the sparkler held up.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs folded or
  dangling, the sparkler lowered or tucked away, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it lifts the sparkler and waves it in a little arc (a happy hello when you tap it),
  then settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Jefferson (`grex`) before calling done. It should read at
a glance as a baby giraffe holding a sparkler, and look like it belongs in the same game. It doesn't need the bosses'
level of detail: clean, cute and readable beats intricate.
