# Dash lying down by your clock, tapping his (Eric, Nov 17): a new figure

Eric: "one more goofy animation, once per game he goes down laying down with his chess clock by your clock … he sets or
holds his clock next to it and starts tapping it for a few seconds."

**This is not a whole boss:** it is one extra figure of an existing boss, Dash (his art's name, Blitz), in a frame of its
own. It needs exactly the three animations below (`idle`, `lieDown`, `getUp`), nothing else: ignore any warning about a
boss's other animations (entrance, thinking, move, …) missing. Export one character, id "dash-lie", named `DASH_LIE`.

## Match him exactly
His finished drawing is `packages/app/src/characters/boss-blitz.ts` (read it first, and look at the reference pictures:
his idle, smug and scramble warning). Use **his palette, exactly** (copy the `PALETTE` object's keys and colors), his
outline, his proportions and his pixel scale (his standing figure is 72 x 104 of his pixels, about 95 tall): the same
cheetah, gold-tan fur with black spots, black tear marks, the backwards orange cap, the teal and orange track jacket,
the sneakers, the long tail, and **his white chess clock** (two faces with ticks, never numerals, a red flag, two
buttons on top). Your file must stay self-contained (import only sprite.ts and paint.ts): copy what you need from his
drawing, don't import it. No letters or numbers anywhere. Never base him on, name or hint at a real person.

## The frame and the pose
- Frame: `w: 128`, `h: 60` of his pixels, `foot` at the bottom middle (`[64, 57]`), the floor at about y 57.
- He lies **on his side along the floor, his head at our left**, propped up on his near elbow with his cheek in that paw
  (a lazy "I'm so bored waiting" lounge), body and legs stretched out to our right, one sneaker crossed over the other,
  the tail curling up at the far right end. His face turned toward us, a bored, sly grin.
- **His clock stands on the floor at the far left of the frame, in front of his face**, upright, about his standing
  clock's size (it is the clock the game sets right beside the player's own clock on screen). His free paw reaches over to
  its button.
- Nothing may touch the frame's edge; keep 2 px clear all round.

## The animations
- **lieDown** (once, about 450 to 600 ms): he zips in from our right in a blur of speed lines (like his entrance's
  zip-in), drops onto his side, plunks the clock down in front of his face and props his head on his paw. `cue: "zip"` on
  its first frame. Its last frame is `idle`'s first.
- **idle** (`loop: true`, a cycle about 700 to 900 ms): lying there, **tapping the clock's button** with one claw, two
  taps a cycle (the button and the flag nudge on each tap; tiny tap lines), his eyes half-lidded on us, the tail flicking
  lazily, the top foot bobbing. `cue: "tap"` on each tap's down frame (exactly two a cycle). Seamless loop.
- **getUp** (once, about 350 to 450 ms): he springs up off the floor and zips away to our right with his clock, in a blur
  of speed lines, gone by the last frame (its last frame empty or only fading lines). `cue: "zip"` on its first frame.

## Checks before `done`
- Render each animation at 4x and look at every frame, on dark and light (`bg`), and at phone size: at 1x he must still
  read as Dash lying down with a clock.
- His palette keys and colors exactly his; nothing touches the frame's edge; cues only as above.
- In your notes: each animation's frames and lengths beat by beat; where the clock stands (its box in the frame's pixels,
  so the game can line it up beside the player's clock) and where his face is.
