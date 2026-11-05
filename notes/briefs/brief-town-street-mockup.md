# Brief: a real town, mockups only: the street views and a revised plan (art; Opus high)

Worktree `/home/user/cr-hollowart`, branch `claude/boss-art`. It's shared: run `timeout 60 git pull --no-rebase origin claude/boss-art`
before each push, and never force-push. Draw by hand on the weekly plan usage, not the API runner. **Mockups only: no app code.**
This is to show Eric what it would look like before anything is built. Include notes/briefs/rules-common.md.

## Context
- Today's town is 46 x 46 squares that wrap. Boss homes are 3 x 3 plots scattered on open chessboard, with the Colosseum and the park
  in the middle: `packages/app/src/town/world.ts` (HOMES, COLISEUM, PARK, PARK_PLAN).
- Every building is one flat front picture (billboard): `town/houses/*.ts`, including `coliseum.ts`. The camera looks north from
  you, on a curved world with the sky (and its day/sunset/night) above the horizon (`camera.ts`, `render.ts`, `sky.ts`, `feel.ts`).
- My first sketch, which Eric liked ("you're understanding the vision"): `notes/briefs/assets/town-redesign/town-proposal.png` (built
  by `maps.cjs` beside it), and today's plan `town-now.png`.

## Eric's direction (Nov 5, his words condensed)
1. **Keep the world's size (46 x 46)**, so the curve stays the same. **It still wraps** ("Pac-Man style, just draw a street": a
   street along the seam, so walking off one side brings you back on the other). He also floated stopping the camera at the far
   left/right. Show the wrap; mention the other if you see a reason.
2. **Streets lined wall to wall with buildings, like a cartoon town's streets**: rows of everyday "dummy" buildings, each different,
   some bigger. Most can't be entered; the boss homes (and later a few others) can, and they stand out. Taller or bigger buildings can
   stand **behind** the front rows, to suggest more town beyond that you can't reach. **The sky must stay visible over the
   rooftops** (he loves the sunset); the feeling is "dropped into a town that's inviting".
3. **The roads stay the chessboard.** Sidewalks run along the buildings. Bosses wander near their own homes, not out in the street.
   No cars for now.
4. **The park becomes a plus:** the promenade stays north–south, and a new east–west walk crosses it through the fountain. Remove the
   middle chess table on each side (the walk goes there) and any tree in the walkways. Add 4 tables (two each side of the new walk) for
   12 in all, kept in the cozy "tucked into the sidewalk" feel it has now. The four park walks lead out into the four streets.
5. **The camera rotates with the street (key idea).** When you run down a street that goes another way, the view turns smoothly (it
   still follows you) so you always see the buildings' **fronts**. That way no building has to be built in 3D.
   - The **Colosseum** is a flat picture (Eric's right). Either keep every view of it front-on (say how the plan does that), or flag
     that it needs more angles or a 3D build.
   - Work out what the buildings on the **near** side of a street (between the camera and you) look like: their backs, cut away,
     low roofs only, faded, or no near row at all. Mock the best two side by side and recommend one.
6. **Default view: the zoomed-in one** (today it opens zoomed out), so it feels like running round town.
7. Overhead plan: no "A, B, D" placeholder labels. Real-looking rows of buildings, the boss homes among them, bigger buildings behind.

## Deliver (stills only, no GIFs)
- **Revised overhead plan** (46 x 46, north up): the plus park with 12 tables, the four streets out of it and how they connect
  (including the seam street), wall-to-wall building rows on every street with the 16 boss homes placed along them (themes: Fire & Ice,
  Funfair, Meadow, Gallery; your call where it reads best, keeping Eric's pairs side by side: Ginger beside Jefferson, Hollow beside
  Moo & Moon), the bigger background buildings, the Colosseum, and which way the camera faces on each street (arrows).
- **Game-camera mockups at the zoomed-in default**, phone 390 x 844 and computer 1440 x 900. Use the town's real camera (curve, pitch,
  zoom), sky and real art (homes, park props, pawn) and the same scale; new rough facades are fine:
  1. In the park looking north up the promenade to the Colosseum, the new east–west walk crossing.
  2. On an east–west street: facades wall to wall, a boss home among them, bigger buildings behind, the sky over the rooftops (day).
  3. The same street at sunset.
  4. Turning a corner onto a north–south street: three frames (before, mid-turn, after) showing the camera turning.
  5. The near-side options side by side (from 5).
  6. Crossing the wrap seam, if it shows anything (else skip).
- **The everyday buildings:** a sheet of 6 to 8 rough facade designs (cottage, townhouse, row of skinny houses, small apartments with
  balconies, a bakery/cafe front, a shop with an awning, a taller background block), plus how they tile wall to wall. Rough is fine;
  they get properly drawn once Eric picks.
- Notes `scripts/boss-art/out/town-street-mockup-nov5.md`: what each still shows, your calls (near side, the Colosseum, the corner
  turn, the seam, the plan's numbers: rows, building widths, street widths), what it would take to build, and anything that would hurt the
  frame rate. Pull, then push. Reply with the head sha, the still paths and your calls.

## Rules
- Original buildings only: a cartoon town feel, but no copying any existing game's town, buildings, characters or logos. No real brands
  or real people.
- Sprites always on screen (Eric, Nov 4) in every mockup.
