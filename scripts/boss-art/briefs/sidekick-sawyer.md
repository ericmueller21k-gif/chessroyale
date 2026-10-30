# Sawyer's sidekick: a raccoon kit apprentice with a toy saw (a town bot)

Draw a **little raccoon kit**: Sawyer's sidekick. Sawyer is the game's raccoon boss, in a wide, aggressive stance with a toothy grin, a yellow hard hat, a black bandit mask, white gloves, a striped tail and a red-and-black reciprocating saw (read `packages/app/src/characters/sawyer.ts`: the look, the palette
and how it's built). The sidekick is a **bot that walks around the town square** and plays chess with people at the park's
tables. It has no powers and never fights: a friendly, curious kid who copies the big one.

## The look
- A small raccoon kit, clearly a baby: a big round head with a soft black mask round big shiny eyes, round ears, a small friendly smile (no teeth bared), a round body, a fluffy striped tail. Cute and readable first.
- **Distinct from Sawyer**, not a small copy: friendly, not aggressive (no wide stance, no toothy grin, no power tool). Its link to him: **a hard hat too big for it** (his yellow; borrow from `SAWYER_PALETTE`) that tips over its eyes now and then, and **a little wooden toy saw** held in one paw.
- Three-quarter view, facing our right (as the other sidekicks do), light from the top left, a dark outline (the palette's
  `k`) like every other character, whole pixels, true pixel art.
- **Size:** about 60% of Sawyer's height at most (it stands among the town's pawns and bosses); a frame about 48 to 64
  pixels tall, feet near the bottom. Big, simple shapes: at phone size its head, eyes and its one prop must read.

## The animations (a few frames each; whole pixels)
- **idle** (loops, about 3 s): it bobs gently, blinks, its tail swishes, now and then it pushes its big hard hat back up.
- **walk** (loops, about 0.6 s): a quick little scamper, head bobbing, the tail swinging, the toy saw held up.
- **sit** (loops): sitting on a stool at a chess table, seen from the side it faces the board (our right): legs dangling,
  its prop lowered or set down, a slow blink now and then, as if thinking about a move.
- **wave** (plays once, about 1.2 s): it waves the toy saw hello, its hard hat wobbling (a happy hello when you tap it), then it settles back to its idle pose.

## Quality bar
Look at each animation at 4x and the idle at phone size beside Sawyer (`sawyer`) before calling done. It should
read at a glance as a little raccoon kit in a big hard hat with a toy saw, and look like it belongs in the same game as Jefferson's sidekick
(`scripts/boss-art/out/sidekick-jefferson-sonnet-2/sidekick-jefferson-sonnet-2.ts`, the one Eric picked: match its size,
outline weight and level of detail). It doesn't need the bosses' level of detail: clean, cute and readable beats intricate.
