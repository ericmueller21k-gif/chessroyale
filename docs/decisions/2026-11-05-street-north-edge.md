# The street town's north edge: one solid back wall, the Colosseum in 3D (Nov 5, 2026)

Eric, Nov 5, on round 5's plaza (his screenshots: `notes/briefs/assets/street-north-edge/`): "There's nothing behind it. It's at the end
of the map … it's a solid back wall … the most back thing is the Colosseum, with gates running along and then exits out of the gates into
the town … beyond that you can add housing again … if you were standing near the Colosseum and tried to change your viewpoint … we
probably have to actually draw the Colosseum out, at least on the sides, because the way it's glitching right now looks really sloppy."

Still an admin's town only (`STREET_TOWN`). Brief: `notes/briefs/brief-street-north-edge.md`. Round 5:
[2026-11-05-street-fixed-view.md](2026-11-05-street-fixed-view.md); everything there stays but what's below.

Eric's second look (Nov 6), on the first stills: the plaza's front wall "looks like the Colosseum is behind this random wall, and it looks
very small, and it looks worse than it did before"; and on Meadow Street, "Moo & Moon Meadow and Hollow Peak right next to each other, with
a little building squeezed in … a terrible design. Nothing should be that close … not two bosses." On the redesign's stills: "Yes,
everything looks good… run one quick test… rotate the camera… 15 degrees… Make sure… the Colosseum's not glitching… If that passes, then
we're good to push it." It passed (below).

## One back line, the Colosseum its centerpiece

- **The line is y = 43.5** (`street-plan.json coliseum.line`). A solid wall (148 px, half a square deep) stands on it the whole way round
  (the town wraps east–west), in stretches of six squares, and meets the Colosseum's ring at its flanks: the Colosseum is the wall's
  centerpiece, its front about 1.5 squares proud of the line.
- **A gate either side of it,** a little past the statues (columns 13–16 and 29–32): a taller stretch of the wall with a grand arch and
  the crown's crest, open onto the trees behind it. You walk up to a gate; you never walk through it (the line is the town's edge).
- **North of it:** the Colosseum and a plain meadow, ground as past the old edge was (the call was to draw it rather than leave a hole,
  since from the overview step you see over the wall). Nothing walks there or stands there but the ring and the trees behind the gates.
  The board's squares are drawn under the oval only.
- **The plaza is open to Colosseum Row:** no wall between you and the Colosseum (round 6's first front wall, with three gateways, is gone).
  It runs from the street's north sidewalk (row 39) to the line, columns 13–32. The queen and king flank the portal and the two statues
  stand before the ring's flanks; the bishop and rook, and the knight and pawn, mark the plaza's front corners. Statues and pieces nearer
  the camera than you fade out, as trees do, so they never hide you.
- **Homes beside the plaza** (Boingo's, Tiger's, Big Boy's and Dash's, rows 40–43) back onto the wall.

## Upper Street moved south: Meadow Street

- Upper Street and its row of homes are gone from north of the line. The map grows 8 rows south: **Meadow Street** (rows 4–6) between
  the closing row and South Street. Hopper's, Wrangler's, Moo's and Hollow's homes stand on its north side, fronts south, backed by a row facing South Street, as Timber's block is; a lane crosses the block on the promenade's line.
- The world is square (`camera.ts N`), so it grows 8 columns east too: 54 × 54. Every street runs 8 squares longer; Seam Avenue moves to
  columns 52, 53, 0 and 1 and runs from Meadow Street to Colosseum Row.
- **Meadow Street is three squares wide** (the others are four), so South Street keeps a sidewalk on its south side (row 11). Without
  it, South Street's south row stood right at the street's edge: looking along the street, the fronts beside the camera are the ones
  the near cut leaves out (nothing between the camera and you), and sky showed beside Hollow Peak's roof. With the sidewalk, the row
  stands as far from you as every other street's does.
- Every boss home keeps its card, door, strip and rest square. The start is the same square of the park as before, (22, 25), and the
  park's zoom-out area moves with it.
- **Boss homes are never neighbors** (Eric's rule, for the whole street town): between any two boss homes in a row stands at least one
  whole look-alike, and no look-alike is narrower than the narrowest normal one, **1 square** (`rows.ts ROW_MIN_W`; round 4's slim
  fillers went down to 0.6). Lots moved along their rows, door, rest square and wander box with them (squares east): Hollow +2 (off Moo's),
  and to leave no sliver beside a home Hopper +1, Wrangler +1, G-Rex +1, Timber +1, Sawyer −1, Tiger −1. A lamp
  that landed on a door or rest square steps a square aside. `test/town-north-edge.test.ts` checks every row.

- **The row behind a home with no side walls is always drawn** (`boxes.ts openBehind`): a dome or a slope (Ginger's igloo at 1.3x,
  Hollow's peak, Hopper's grassland, Alfil's) doesn't hide what's behind it the way a box does, so the rows' culling no longer leaves out
  the fronts back to back behind one. Without it, sky showed under Ginger's dome looking along Fountain Street (WebGL).

## The Colosseum as a solid

- **A ring of 18 equal stretches** round an oval 17.6 squares across and 14 deep (`houses/coliseum-shape.ts`,
  `houses/coliseum-ring.ts`). Each stretch is a box the box renderer draws from any heading: its front the outer wall (three tiers of
  arches, the attic's band of the board's squares, today's palette and stone), its roof the rim, the seats stepping down inward and the
  podium's checkered wall. From the plaza you see its wall curve away; from the overview, into the bowl.
- **Big and looming** (Eric: "it looks very small"): its art drawn 1.2 times the town's scale (`COL_SCALE`), about 8.5 squares to the rim;
  from the park on a phone its ring fills about 85% of the width and its top runs off the top of the box. Its back reaches a square and a
  half past the map's north edge, where nobody goes.
- **The portal** before its front, on the plaza: the gate, "THE COLOSSEUM" tablet and the relief of chess pieces; the Colosseum's own box
  (a tap on it, or on the ring, opens its card). Banners on the four stretches either side of it, the flag over the one behind.
- **Drawn where it stands, over the rows' roofs from near enough** (no line-of-sight rule). Round 4's line of sight (`colosseumSeen`) and
  round 5's flat street picture are gone. Today's Colosseum outside the street town is unchanged.
- **Looking round beside it:** a drag swings the camera round your pawn, so on the plaza it passes close by the ring. The ring and portal
  are never left out by "nothing between the camera and you" (you always stand before them) and are cut nearer the camera, so you see its
  wall up close, never into its bowl. Only the stretches close by get the fine strips on the 2D fallback, and below its rim its bowl (rim,
  seats, podium) is left out, hidden behind its wall anyway: what kept the frame rate (PR body).
- **It stays put as you turn** (Eric's rotation check): from four squares before the portal, turning 15 degrees at a time to ±45, the
  portal and every stretch in view stand on their own ground to a pixel or two, moving across the box exactly as the ground does
  (`e2e/town-fixed.spec.ts`, "the Colosseum stays put as the view turns"; stills `docs/street-north-edge/rot-*`).

## Ported from the paused round (`claude/street-colosseum-big`)

- Moo's paddock and Ginger's dome drawn 1.3x in their rows (`TOWN_FEEL.streetHomeScale`, `rows.ts homePx`).
- The tap guard: a tap on a row's front (or any building's side, back or roof) never opens something drawn behind it.
- Its flat Colosseum's line of sight is left out, as the brief says.
