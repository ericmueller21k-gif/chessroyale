# Brief: the street town's controls (hold to run, locking a new view) and a minimap (Opus high)

Worktree `/home/user/cr-controls`, branch `claude/street-controls-map`, from main. Set it up with `npm ci`; never symlink
node_modules. Ports 8988, inspector 9488. Include notes/briefs/rules-common.md (American English). This is still the admins'
street town only (`STREET_TOWN`); today's town is unchanged. Push as you go.

A second helper is working at the same time on `claude/street-north-edge`. It changes the plan (the back wall, Upper Street
moved south, the map grown south) and draws the Colosseum in 3D.
- **Don't touch the plan, the walls or the Colosseum's drawing.**
- **Build the minimap from the plan's data** (`street-plan.json`, the lots, streets, park and Colosseum), not hard-coded
  positions, so it follows their change.
- They merge first. You then merge main into your branch, fix the conflicts and rerun your checks.

Read first:
- `docs/decisions/2026-11-05-street-fixed-view.md`;
- `town/turn.ts` (`Turn`, `LookAround`, `nearestTurn`) and `town/strips.ts`;
- `Town.tsx`'s pointer handling (press, drag threshold, `look`), `town/arrows.ts` (`keyWalk`, `screenStep`, `rowsUp`) and
  `town/zoom-steps.ts`.

## Eric, Nov 5 (his words, trimmed)
- **Hold to run:** "If you hold your mouse click down right now, it does nothing … if you hold it in the direction … up, down,
  left or right … right away … it starts running in that direction … it's a little too tough to run around on mobile."
- **No turning while running:** "when you're holding down and you're running in a direction and the game detects that you're
  running, if you were to move your finger, instead of it rotating the screen, it doesn't. It will start running in whatever
  direction you now are holding … the ability to rotate the screen is locked when you're in the running state."
- **Locking a new view:** "when you swipe … and change direction, if it detects that you're … within 10 degrees of a new 90-degree
  baseline, and then you tap in that direction, it switches your view. So that becomes your straightforward … it locks in … It'll
  always default back to the normal [view] if you go into a building and come out … we do need to re-add the ability for the
  camera to change … sometimes I just want to look around and then tap on a different street and have it lock that direction for
  me."
- **The minimap:**
  - "on by default … an overlay on the top right, partially see-through, not super big … shows where your guy is … the Colosseum
    basically outside the map, on the edge … a thin line … so players can see when they run to the top that they're at the top."
  - "It should be an actual representation of the overhead … no labels."
  - "Another icon [with our other icons] … click it, it turns it off."
  - "If you tap the minimap, it comes to the center of your screen … all of Chess Town … put the little icon of which boss is at
    which shop … the Colosseum, the park … tap it again or tap away, back to normal size."

## Design (the director's)
1. **Three gestures, told apart by the existing tap/drag threshold and a hold time** (a number in the feel, about 180 ms):
   - **Quick tap:** walk to the square, as now.
   - **Press that moves past the drag threshold before the hold time:** look round. Rotate, as round 5's drag.
   - **Press held still past the hold time:** run. You run in the screen direction from your pawn to your finger, snapped to
     up/down/left/right of the current view, starting at once.
     - While held, moving the finger changes the run direction (re-snapped each step) and **never rotates the camera**.
     - Letting go stops you at the next square.
     - A run into a home's door opens its card, as the arrows do.
     - Mouse: the left button, the same rules.
2. **The base heading can be any of the four directions** (north, east, south, west), not only north.
   - **On release after a look round:** if the camera is within **10°** of a 90° direction (a number in the feel), it eases to that
     direction exactly. Otherwise it stays where you left it, as now.
   - **Locking it in:** if you're snapped to a new direction and your next move is a tap (a walk) or a hold-to-run, that direction
     becomes the new base heading. The arrows, the screen step and run directions follow it. The camera stays there.
   - **Not snapped:** your first step eases back to the base heading, as now.
   - The arrow keys never change the base heading.
   - **Going into a building and coming out, and opening the town, reset it to north.** Record in the decision note whether a home's
     strip turn should also reset it.
   - Keep #502's `rowsUp` and the strip turn working at any base heading.
3. **The minimap** (street town only, on by default):
   - **Small view:** top right, about 26% of the screen's width on a phone, smaller on a computer. Partly see-through (about 70%
     opaque), with rounded corners.
   - **What it draws:** the plan from above, north up. Streets, the park, home lots as soft blocks, the walls. The Colosseum is a
     thin band on the top edge.
   - **You:** a bright dot with a small arrow for the way the camera faces, which shows the base heading at a glance.
   - **Labels:** none in the small view.
   - **The icon:** a new map button in the town's icon row (with the chat and settings buttons). It turns the map off and on,
     with the choice stored per device and on by default.
   - **Tap the small map** and it opens large in the middle of the screen, the whole town:
     - each boss home with its boss's small portrait (the same portraits the town uses), with no names;
     - the Colosseum and the park as small icons;
     - you as the dot.

     A tap on it or anywhere outside closes it. It doesn't walk you anywhere.
   - **Cost:** draw it cheaply, with the static layer drawn once to an offscreen canvas and only the dot redrawn each frame. Check
     the town's frame rate with it on and off.
   - **Layout:** it must never cover the on-screen arrows, the zoom buttons or the chat. Check every phone size and the computer
     layout.
4. **The default zoom.**
   - Eric: "make it the middle one of the three if it's not already." There are 4 steps today (fully in, the default (the mockup's,
     index 1), out, overview), opening at 1.
   - Keep 1 and say so in the report; the director will ask Eric whether he meant the next one out.

## Done
- **Unit tests:**
  - the gestures (tap, drag, hold) by time and distance;
  - the run direction snapped from the finger and changing while held;
  - no rotation while running;
  - the 10° snap and locking it in on a tap or a run;
  - no lock when not snapped;
  - the reset to north on a building's in and out;
  - arrows following the base heading;
  - the minimap's mapping (plan to map pixels), the dot and arrow, and the toggle stored.
- **e2e** (phone and computer, 2D and WebGL):
  - hold to run in each direction;
  - slide the finger mid-run: the direction changes and the camera doesn't turn;
  - drag to within 10° of east, release, tap: the base heading is east, and the up arrow goes east;
  - into a home and out: north;
  - the minimap shows and moves with you;
  - the toggle hides it;
  - a tap opens it large with the boss portraits, and a tap closes it.
  - Update the existing checks and list them old → new.
- **Stills and GIFs** in `docs/street-controls-map/`:
  - the minimap small and large (phone and computer);
  - a GIF of hold to run with a mid-run turn (phone);
  - a GIF of the look round, snap and lock (phone).
- **The PR body** in `docs/street-controls-map/pr-body.md` (lane: full e2e) and **a decision note** in
  `docs/decisions/2026-11-05-street-controls-map.md` quoting Eric.
- Don't open the PR. Stop with a short report.
