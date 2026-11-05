# Street town, round 4: the rows and the chase camera (mockup, Nov 5)

These stills come from the real game: an admin's street town (`STREET_TOWN`), drawn with WebGL (`?gl=1`), on an iPhone 13 and a
1280 x 800 computer. `e2e/town-rows.spec.ts` takes them with `STILLS=docs/street-town-rows/mockup`.

| Still | Where you stand | What it shows |
|---|---|---|
| `1-fountain-street-close-day-phone`, `-desktop` | (4, 14), after walking east | Fountain Street from its west end, close zoom. North side on the left: Timber's lodge, look-alikes, Sawyer's woodshed. South side on the right: all look-alikes, including a landmark with a round cap. The street runs on to the park. |
| `1-fountain-street-close-dusk-phone`, `-desktop` | same | The same view at dusk: lamps and windows lit. |
| `2-fountain-street-far-day-phone` | same | Zoomed out (the − button): the camera is higher and further back. |
| `3-corner-mid-turn-phone` | (0, 14), after walking south down Seam Avenue | The corner of Fountain Street and Seam Avenue halfway through the turn east (heading held at 135°). The corner building shows a front on both streets. |
| `4-colosseum-seen-phone` | (22, 17), after walking north | The park's promenade opens onto the Colosseum, so it shows. |
| `5-colosseum-hidden-phone` | (8, 15), after walking north | Fountain Street's north row hides the Colosseum. Under round 3's rule, its far drawing would have stood over these roofs. |

## Built in real code

- **Rows as data** (`packages/app/src/town/rows.ts`). A row side lists:
  - its street, its facing, its two ends and whether each end is a corner;
  - its slots.

  The boss homes stay where the plan puts them and anchor the row. Look-alike fronts fill every gap between the homes, and between a
  home and a row's end. Widths are seeded picks of 1 to 3 squares, and a slim filler of 0.6 squares or more takes what's left.
  Heights are seeded too, and a neighbour of the same height is usually bumped, so the roofline steps. There is one landmark a side
  when asked.

  So far only Fountain Street's four sides are rows: north and south of the street, west and east of the park.
- **Look-alike fronts** (`lookalike.ts`). A parts generator, as Eric described ("most of them aren't actually like real buildings"):
  - a body in one of 14 colours and 6 materials;
  - 2 to 4 floors of windows, with or without shutters, arches, flower boxes or a balcony;
  - a ground floor with either a door and windows or a shop (an awning, a display window and a glazed door);
  - one of 6 roof caps: a cornice, a gable, a stepped gable, a round "bulgy" cap, crenels or a mansard.

  The wall fills every column of the picture, so neighbours butt with no gap, and each one overlaps the next by 1 px so a rounding
  crack never shows sky. A corner's end wall is drawn as a second front, with windows on every floor and a door. All other party walls
  are hidden by round 3's cover rule. There are no words or brands on any front.
- **The plan under the rows** (`street.ts`):
  - the everyday buildings on those sides are replaced by the rows;
  - the ground under a row becomes a lot, which you can't walk on;
  - that ground is drawn paved, so the sidewalk runs up to the fronts with no lawn in between;
  - the hedges, beds, sheds and bushes the rows now cover are gone (lamps stay on the sidewalk);
  - the Seam Avenue lot at (3, 9) is now Fountain Street's south-west corner building.
- **Boxes facing all four ways** (`boxes.ts`). Fronts can now face north and east too, not just south and west.

  A wall that runs past the camera, like a row beside you, is cut where it crosses the camera's near plane. Before this, the whole
  wall was dropped.

  Roof paintings are made for each of the four quarters, not just north and east.
- **The chase camera.** It sits low behind your pawn, looking the way you're heading:
  - The camera numbers are `camStreetTall` and `camStreetWide` in `feel.ts`. The horizon sits about 0.36 of the way down the phone's
    canvas, and your pawn is in the lower middle.
  - The heading follows your walk (`turn.ts chaseTarget`, with the walker's `leg`). It snaps to the four directions and eases over
    0.4 s (`streetTurnMs`).
  - On a tap's path, it turns only for a leg of 2 squares or more, or for the last leg.
  - With the arrows: up walks forward, down steps back without turning, and left and right turn you and step that way. A held key
    goes through the way you faced when the hold began, so holding right turns you once and then runs on.
  - Taps work as before. The − button zooms out higher and further back, using round 3's zoom-out numbers.
- **The Colosseum hides behind the rows** (`street.ts colosseumSeen`). It shows only when a straight line from your square reaches
  its outline without crossing a lot. That applies to both the near drawing and the far one, and it replaces round 3's rule of showing
  within 45 degrees of north.

## Stand-ins and gaps (for the full build)

- Only Fountain Street has rows. The other streets are round 3's lots, with gaps between them.
- The corner still holds the heading halfway (the round 3 test hook). The real turn passes through that angle in 0.4 s.
- The look-alikes are full boxes, about 2.3 squares deep with a roof. They are not yet flattened to bare fronts away from corners. It
  costs little, but it isn't the "flat wherever it works" plan yet.
- Not done yet:
  - culling by occlusion (drawing only what the rows let you see), so draw counts and the frame rate aren't measured;
  - any fog beyond the town's existing haze at the rim (16 squares now);
  - the 2D fallback (it uses the same camera; not checked);
  - the skyline beyond today's tall blocks and towers.
- Round 3's checks that the rows and the new camera break (to change in the build, listed old → new in the PR):
  - `town-boxes.test.ts`: "every lot is a box …" and "is drawn in the art's order …", which assume south- or west-facing boxes and
    the plan's own lots;
  - `town-street.test.ts`: "every square's ground as the plan has it" and "stands every everyday building's front …";
  - the heading tests and `e2e/town-street.spec.ts`'s turn test, which expect the fixed north/east camera.

## Against Eric's reference, honestly

- **One unbroken wall of fronts:** yes, on both sides of Fountain Street. The south side is all look-alikes. On the north side, the
  look-alikes butt against the boss homes' bodies, and a home's yard things (signs, log piles) stand in front of its neighbour.
- **No sky or grass between neighbours:** yes, at street level. The sidewalk runs to the fronts. Above the homes, sky shows over their
  lower roofs (see the first open question).
- **Varied widths and heights, stepped rooflines:** yes. Widths are 1 to 3 squares plus slim fillers, heights are 2 to 4 floors, and
  there is a landmark with a tall round cap.
- **Joins:** plain butt joints, as Eric asked later. Each front keeps its own ink edge.
- **What's missing next to the reference:**
  - Our bodies are straight-sided. Only the caps bulge; the walls aren't wonky the way the reference's are.
  - The street's far end opens to the park in haze rather than closing on a building.
  - The fronts are a bit shorter relative to the street than the reference's.

## Open design questions (each with a recommendation)

1. **The boss homes are lower than their neighbours.** Their eaves are 41 to 99 px; a look-alike is 78 to 138 px. In the row, a home
   reads as a dip. *Recommendation:* give the two slots either side of a home 2 floors, so the row steps down to it and its own roof
   and sign stand out. Make the street's landmark a look-alike away from the homes. Don't redraw the homes taller.
2. **Homes keep their plan lots** (doors, rest squares and wander boxes unchanged), so slim fillers of 0.7 to 0.9 squares close the
   gap between a home's body and a corner. *Recommendation:* keep this. It's what the filler is for, and it moves nobody's door.
3. **Streets with gardens on one side.** These are Seam Street's south side and the south sides of Colosseum Row and Upper Street (the
   backs of 3-deep blocks). *Recommendation:*
   - put back-to-back rows of shallow, flat look-alike fronts about 1.3 squares deep on the 3-deep blocks;
   - on the deep block between Seam Street and Fountain Street, put rows on both streets, with the gardens and tall blocks hidden in
     the middle as a skyline.
4. **The 2D fallback.** *Recommendation:* keep the same chase camera if a quick check shows the frame rate holds on Canvas 2D.
   Otherwise, give it the zoomed-out view as its default (the brief allows a higher view).
5. **The Colosseum peeking over roofs.** It is hidden completely when no line reaches it. *Recommendation:* keep it hidden, as the
   brief says. If Eric misses it, let only its flags peek.
6. **Pawn size.** In the close zoom, the pawn is about a fifth of the phone's canvas height, like the reference's close view.
   *Recommendation:* keep it.
