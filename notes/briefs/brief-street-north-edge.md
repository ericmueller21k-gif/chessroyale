# Brief: the street town's north edge: one solid back wall, the Colosseum in 3D (Opus high)

Worktree `/home/user/cr-northedge`, branch `claude/street-north-edge`, from main. Set it up with `npm ci`; never symlink
node_modules. Ports 8987, inspector 9487. Include notes/briefs/rules-common.md (American English). This is still the admins'
street town only (`STREET_TOWN`). Push as you go. Draw art by hand, with no paid API.

A second helper is working at the same time on `claude/street-controls-map` (input, camera heading, the minimap). **Don't touch
input handling, the arrows, the drag or the HUD.** Keep your changes to the plan, the walls, the Colosseum's drawing and
culling. You'll be merged first; the other helper merges main after you.

Read first:
- `docs/decisions/2026-11-05-street-fixed-view.md` (round 5);
- `town/street-plan.json` and `scripts/street-plan-north.py`;
- `town/wall.ts`, `town/rows.ts` and `houses/coliseum.ts`;
- the boxes in `render.ts`.

Eric's screenshots of the problem: `notes/briefs/assets/street-north-edge/` (from the director). Rows run south (0) to north (45):
- **Upper Street** (rows 36–39) runs the full width (wrapping) east and west of the Colosseum's grove.
- **Its four homes** (Hopper, Pig, Moo and Hollow, lots at row 41) stand north of it.
- So there are streets and homes level with and behind the Colosseum, and when you drag to look round near the Colosseum you see
  them past its four-column grove.
- The Colosseum is a flat picture standing up, so turned, it shows as a tilted card.

## Eric, Nov 5
"There's nothing behind it. It's at the end of the map … it's a solid back wall … the most back thing is the Colosseum, with
gates running along and then exits out of the gates into the town … beyond that you can add housing again … if you were standing
near the Colosseum and tried to change your viewpoint … we probably have to actually draw the Colosseum out, at least on the
sides, because the way it's glitching right now looks really sloppy."

## Do
1. **One back line across the whole town.**
   - A solid wall runs the full width (it wraps east–west, so it's continuous) along the line of the plaza's back, where the
     Colosseum's front meets the plaza.
   - Nothing north of it is walkable or drawn except the Colosseum itself and sky, with treetops showing over the wall if you like.
   - From anywhere, looking any way, you never see a street, home, tower or lot beyond the wall.
2. **Move Upper Street and its homes south.**
   - Remove Upper Street and its row of homes (Hopper, Pig, Moo, Hollow) from north of the line. Grow the map south to fit them as
     a new street, with row fronts and look-alikes as the other streets have. Keep every boss home, its card, door, strip and rest
     square.
   - Keep the town's structure:
     - rows of homes on streets;
     - the park in the middle;
     - the Colosseum Row street running under the plaza;
     - east–west wrap on, north–south closed, and the south edge closed as round 4's closing row.
   - Make the change in `street-plan-north.py` and rebuild the JSON.
   - Check the start square and the park's zoom-out area still make sense.
3. **The plaza's walls and gateways.**
   - The plaza in front of the Colosseum is framed by walls running left and right, a little past the statues, with real
     **gateways**: open arches you walk through to leave the plaza onto Colosseum Row.
   - The homes beside the plaza (Boingo's, Tiger's, Big Boy's and Blitz's lots at rows 32–34) keep their backs against the back
     wall.
4. **The Colosseum in 3D.**
   - Build it as a real solid: an oval ring of wall faces (arches and tiers as the art, its palette) that the box renderer draws
     from any heading. It should look right when you drag round near it, with no tilting card.
   - Keep its gate front with "THE COLOSSEUM" tablet, the banners, and the statues planted on the plaza in front.
   - It should feel big. The paused round on `claude/street-colosseum-big` made it about twice as tall (`houses/coliseum.ts`
     `build(Size)`); reuse that size and art where it helps.
   - From the streets south of the park it may show over the rooftops. Choose what reads best and keep it cheap.
   - Today's Colosseum outside the street town stays exactly as it is.
5. **Port from `claude/street-colosseum-big`:** Moo's paddock and Ginger's dome scaled 1.3x in their rows (`streetHomeScale`,
   `rows.ts homePx`), and its tap guard (a tap on a row's front never opens something behind it). Leave its flat-Colosseum line of
   sight out.
6. **Frame rate:** measure the plaza and Fountain Street routes and a look-round at the plaza, against main (2D and WebGL, phone and
   computer). Give the numbers.

## Done
- **Unit tests:**
  - nothing walkable or drawn north of the line anywhere;
  - no street or lot north of it;
  - every boss home present, with a door, strip and rest square;
  - the gateways walkable and connecting the plaza to Colosseum Row;
  - the Colosseum drawn as faces from 8 headings;
  - no square drawn twice.
- **e2e** (phone and computer, both renderers):
  - from the plaza, drag round 360°: no home or street beyond the wall in view (the box draws), and the Colosseum is drawn as
    faces;
  - walk through a gateway;
  - try to go north past the wall: stopped;
  - each moved home's card opens.
  - Update the existing town checks and list them old → new.
- **Stills** in `docs/street-north-edge/`, on phone and computer:
  - the plaza up close;
  - looking round from the plaza (west, east, and turned away from the Colosseum);
  - from the park;
  - a gateway;
  - the new south street;
  - an overview at the top zoom step.
- **The PR body** in `docs/street-north-edge/pr-body.md`. Lane: full e2e, since the plan and drawing are shared.
- **A decision note** in `docs/decisions/2026-11-05-street-north-edge.md`, quoting Eric.
- Don't open the PR. Stop with a short report.
