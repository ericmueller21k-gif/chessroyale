# The street town's north edge: one solid back wall, the Colosseum in 3D (Nov 5, 2026)

Eric, Nov 5, on round 5's plaza (his screenshots: `notes/briefs/assets/street-north-edge/`): "There's nothing behind it. It's at the end
of the map … it's a solid back wall … the most back thing is the Colosseum, with gates running along and then exits out of the gates into
the town … beyond that you can add housing again … if you were standing near the Colosseum and tried to change your viewpoint … we
probably have to actually draw the Colosseum out, at least on the sides, because the way it's glitching right now looks really sloppy."

Still an admin's town only (`STREET_TOWN`). Brief: `notes/briefs/brief-street-north-edge.md`. Round 5:
[2026-11-05-street-fixed-view.md](2026-11-05-street-fixed-view.md); everything there stays but what's below.

## One back line

- **The line is y = 42.5**, where the Colosseum's front meets the plaza (`street-plan.json coliseum.line`). A solid wall (148 px, half a
  square deep) stands on it the whole way round (the town wraps east–west), in stretches of six squares, but for the Colosseum: each end
  runs on under the ring's seats, so no gap between wall and ring shows what's behind.
- **North of it:** the Colosseum and a plain meadow. Nothing walks there and nothing stands there but the ring and a few trees whose tops
  show over the plaza's stretches of the wall. The meadow is ground, as past the old north edge was: the call was to draw it rather than
  leave a hole, since from the overview step you see over the wall. The board's squares are drawn under the oval only.
- **Homes beside the plaza** (Boingo's, Tiger's, Big Boy's and Dash's, now rows 40–42) back onto the wall.

## Upper Street moved south: Meadow Street

- Upper Street and its row of homes are gone from north of the line. The map grows 8 rows south: **Meadow Street** (rows 4–7) between
  the closing row and South Street. Hopper's, Wrangler's, Moo's and Hollow's homes stand on its north side at their old columns, fronts
  south, backed by a row facing South Street, as Timber's block is; a lane crosses the block on the promenade's line.
- The world is square (`camera.ts N`), so it grows 8 columns east too: 54 × 54. Every street runs 8 squares longer; Seam Avenue moves to
  columns 52, 53, 0 and 1 and runs from Meadow Street to Colosseum Row.
- Every boss home keeps its card, door, strip and rest square. The start is the same square of the park as before, (22, 25), and the
  park's zoom-out area moves with it.

## The plaza's walls and gateways

- The plaza (columns 13–32, rows 40–41) is framed by walls along Colosseum Row's north sidewalk (row 39), a little past the statues at
  both ends, with three open gateways onto Colosseum Row: one square at column 15, the grand one four squares on the promenade's line
  (a crest over its arch), one square at column 30. Seen from both sides: the plaza's side mirrors the street's.
- Row 42 is the plinths' row against the back line: the two statues and the six chess pieces stand there as figures of their own.

## The Colosseum as a solid

- **A ring of 18 equal stretches** round an oval 14.8 squares across and 11.8 deep (`houses/coliseum-shape.ts`,
  `houses/coliseum-ring.ts`). Each stretch is a box the box renderer draws from any heading: its front the outer wall (three tiers of
  arches, the attic's band of the board's squares, today's palette and stone), its roof the rim, the seats stepping down inward and the
  podium's checkered wall. From the plaza you see its wall curve away; from the overview, into the bowl.
- **About twice as tall** as round 5's (262 px, 7 squares), the paused round's size.
- **The portal** before its front, on the plaza: the gate, "THE COLOSSEUM" tablet and the relief of chess pieces; the Colosseum's own box
  (a tap on it, or on the ring, opens its card). Banners on the four stretches either side of it, the flag over the one behind.
- **Drawn where it stands, over the rows' roofs from near enough** (no line-of-sight rule): from the streets just south of the park its
  top shows; past the rim, nothing. Round 4's line of sight (`colosseumSeen`) and round 5's flat street picture are gone.
- **Looking round beside it:** a drag swings the camera round your pawn, so on the plaza it passes close by the ring. The ring and portal
  are never left out by "nothing between the camera and you" (you always stand before them), are cut nearer the camera, and get the fine
  strip count on the 2D fallback too: you see its wall up close, never into its bowl.
- Today's Colosseum outside the street town is unchanged.

## Ported from the paused round (`claude/street-colosseum-big`)

- Moo's paddock and Ginger's dome drawn 1.3x in their rows (`TOWN_FEEL.streetHomeScale`, `rows.ts homePx`).
- The tap guard: a tap on a row's front (or any building's side, back or roof) never opens something drawn behind it.
- Its flat Colosseum's line of sight is left out, as the brief says.
