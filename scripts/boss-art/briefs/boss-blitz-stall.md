# Dash (Blitz): three new animations for his stall skit (Eric, Nov 17)

**Your file, `scripts/boss-art/out/boss-blitz/boss-blitz.ts`, already holds him, approved and in the game: read it first.**
The look (palette, parts, proportions, colors, face) and every existing animation must stay exactly as they are. **Extend
it, never redraw it:** add the three animations below with `edit_drawing` (new pose fields in the rig only if you truly
need them, new parts after the existing ones, the new animations after the existing ones), and add them to `anims`. Never
use `write_drawing`. Keep the id "boss-blitz" and the export name. No letters or numbers anywhere (the clock shows ticks,
never numerals). Never base him on, name or hint at a real person.

## Who he is
A lanky, cocky speed-chess hustler cheetah: backwards orange cap, teal and orange track jacket, a chess clock under his
arm. Fast-talking, impatient, a showman, friendly-cocky, never mean. Everything he does is quick and snappy, with clear
held poses that read at phone size (his figure is about 100 px tall on a phone).

## The skit (what the game does around your animations)
Once a battle, when the player takes too long on a move:
1. **He slams his clock for 5 seconds straight** ("smacks the hell out of the clock") and says a hurry-up line. The game
   loops your `slam` for 5 s (about a dozen slams), with a shake and a hit sound on each slam's cue.
2. Ten seconds later, if they still haven't moved, **he plays a second move** (the board shows it; his existing `move`
   animation plays as it lands), then holds your `fakeSmug` for about 2 s while he brags ("Too slow, I'm going again!"),
   then plays your `jkLaugh` ("Nahh, jk bro") as the move slides back and the player's turn goes on.

## The animations to add
- **slam** (`loop: true`; one cycle about 700 to 900 ms, two slams in it): he holds the clock out in front of him (toward
  the board, our left, a little up: use the rig's `clock` offset) and **pounds its button hard**: the near paw wound up
  high, then slammed down with big click sparks, the clock jolting, the flag jumping; a second, quicker slam. An
  impatient, fed-up face: brow down, ears back, teeth gritted (the `grimace` mouth) or yelling (`wide`). It must read as
  angry hammering, far harder than his idle's tap and his `move`'s slap. The cycle must loop seamlessly (its last frame
  leads into its first). Put `cue: "slam"` on each slam's down frame (exactly two cues a cycle) and a small `shake` there.
- **fakeSmug** (`loop: true`; a cycle about 1.2 to 1.6 s): his "I'm going again" brag while his second move sits on the
  board: leaning back, chin up, half-lidded sly eyes at us (`eyes2: "sly"` or "us"), a cocky grin, buffing his claws on
  his jacket or a slow finger gun at the board then back; the tail flicking. Small motion, mostly a held pose. No cues.
- **jkLaugh** (once, about 1.3 to 1.6 s; ends on a pose that returns cleanly to his idle's first frame): he bursts out
  laughing: head thrown back, eyes shut in joy (`eyes2: "joy"`), mouth wide, shoulders bouncing, slapping his knee or the
  clock; then straightens up with a wink and a finger gun at us ("jk, bro"). `cue: "laugh"` on its first frame only.

## Checks before `done`
- Render each new animation at 4x and look at every frame; then the idle at phone size beside another boss, to be sure
  nothing else changed.
- Every existing animation unchanged (don't edit their code); his frame size (w, h, foot) unchanged; nothing touches the
  frame's edge.
- Cues: only "slam" (slam), "laugh" (jkLaugh), none in fakeSmug.
- In your notes: each new animation's frames and lengths beat by beat, and any new pose field or part you added.
