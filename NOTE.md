# Birdie's lobby and bartender, round 2 (Nov 23): stills and notes

Drawings and briefs: `claude/boss-art`, commit dca0caf7. Lobby: `scripts/boss-art/out/shop-birdie-interior-3/`. Bartender:
`scripts/boss-art/out/sidekick-birdie-bartender/`. Stopped runs are kept beside them (`-stopped`).

## Spend (API dollars, Opus 5.5 high; plan usage: none)
| Run | Result | API $ |
| --- | --- | --- |
| Lobby, first: one turn tried to write round 1's whole 691-line file in one call and hit the 48,000-token ceiling | stopped, turn 6 | 1.18 |
| Lobby, second (cap $6; ceiling raised to 96,000; written in parts) | done, 24 turns | 2.99 |
| Bartender, first: a 2600 x 3978 px reference broke the 3,000 px many-image limit | stopped, turn 20 | 2.11 |
| Bartender, second (cap $3): the spend guard stopped it before a turn that could have passed the cap | stopped, turn 14 | 2.03 |
| Bartender, third (cap $4, reference resized to 2000 px) | done, 22 turns | 1.21 |
| **Total** | | **9.52** |

The brief planned two runs at about $12 at most. Five ran because of three failures; the total stays under $12.

## What changed
- **Lobby (12 x 12, same size as round 1):** seed jars and sacks on shelves behind the bar; the U-shaped bar with stools on all three
  outer sides (4 south, 3 west, 3 east) and 6 birds; bird feeders on the counter in place of drinks (7); a galvanized seed vat with a
  scoop inside the U beside the bartender's place; a small white-topped table (1 x 1) with one stool on its left and one on its right,
  two feeders on its top and two on the floor beside it; a gravel railroad crossing in the front-left corner with kitty-corner gates.
  The board, arches, seats, lamps, plants, floor and doorway are kept.
- **Bartender:** the scoop replaces the glass and towel. Idle (19 frames, 5.3 s): he dips the scoop in the vat, lifts it, tips the
  seed over a counter feeder, pauses and nods, and loops. Wave (10 frames): sets the scoop on the counter, then waves.

## Calls I made (mine)
1. **The lobby was built from round 1's first frame, not round 1's file.** The runner's read tool can't reach
   `out/shop-birdie-interior-2/`, so the model redrew the room from the picture. The look matches round 1; the code is new.
   Export names are kept (`SHOP_BIRDIE_INTERIOR_3`, id `shop-birdie-interior-3`, `SHOP_BIRDIE_BARTENDER_SPOT = { col: 6, row: 2 }`).
2. **"Smaller" table:** 1 x 1 (about 30 x 44 px, white top 30 x 28), not round 1's 2 x 2.
3. **"In the corner":** read as the front-left corner, nearest the door.
4. **Feeders on the table:** two on its top, two on the floor beside it, per "around the table."
5. **Vat in metal, not wood;** the seed heap is yellow, cream, brown and red.
6. **The bartender's pour lands 26 px right of his feet and 28 px up** (his notes). The feeder under the pour must sit there.

## For Eric to check
- At 1x, the counter feeders have red roofs and read as little red birdhouses. Say if they should be plainer.
- Bird and feeder sizes are small (birds 9 x 8 px; floor feeder 7 x 12 px).
- Bartender height: frame 56 x 60 px; his head is about 53 px up from the ground; his face is about 47 px up; his bow tie is about 34 px up;
  the counter's top is 31 px up, so he stands behind it with his head and bow tie showing.

## Wiring later (not done here)
- The game's room default is 20 squares; the shop call site must pass 12 (round 1's note).
- Round 1's bartender id is `sidekick-birdie-bartender`; this pass keeps it.

## Stills
- `lobby-first-frame.png`: the room's first idle frame, full size (1776 x 2108).
- `lobby-idle.gif`: the room's idle loop.
- `compare.png`: round 1 (left) and round 2 (right), side by side.
- `bartender-idle.gif`: the idle loop.
- `bartender-frames-sheet.png`: every bartender animation frame at 4x, from the run's own preview.
- The run's phone-size comparisons and every look are in the run's `preview/` and `looks/` folders (not committed).
