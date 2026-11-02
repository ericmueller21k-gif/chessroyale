# Inside Alfil's Pyramid: Alfil's shop

You are drawing a **room**, not a boss: the inside of Alfil's home on the town square, an ancient stepped pyramid.
Alfil is the old elephant chess piece (the bishop's ancestor; "alfil" means elephant). The player walks up to Alfil's
Pyramid, taps "Go in", and the view fades into this room, about **20 x 20 squares**, seen the way the town is seen.
Inside, a Shopkeeper stands behind a counter that sells "Alfil's Boss Crate". The Shopkeeper is Alfil's kid, a woolly baby
mammoth. The game reuses the kid's existing sprite, so **don't draw the kid**. The game's code (written later by another
helper) lays your pieces out from your layout.

This is the third shop. The first two were Babur's circus tent and Puddles' greenhouse:
- `scripts/boss-art/out/house-shop-puddles/house-shop-puddles.ts`, with its briefs `scripts/boss-art/briefs/shop-puddles-interior.md`
  and `-2.md`;
- `scripts/boss-art/out/house-shop-babur/house-shop-babur.ts`.

**Read the Puddles file first and follow the same structure**:
- one file;
- each piece its own `Character` (`shop-alfil-<name>`, all in `SHOP_ALFIL_PIECES`);
- `SHOP_ALFIL_LAYOUT` (`ShopPlace`, with `w` and `d` for wide and deep pieces);
- the whole room as one still, `HOUSE_SHOP_ALFIL` (id `house-shop-alfil`), with one extra animation per piece for viewing;
- the same footing (a wide piece stands on the middle of its width, on the middle of its row) and the same flat 37 x 37
  floor tiles.

Reuse its helpers' ideas, but not its colors.

## What Eric asked for (Nov 2)
- "Pyramids, pharaoh statue, artifacts, shiny relics etc. Egyptian style etchings on the walls, and the elephant chess
  piece as a large statue. Not sure what the animated object should be. Opus can think of one."
- About the other shops: "Really like the effect you did in the shops where the background is like windows for hippo,
  etc, looks very clean, keep doing this same for all shops."

So the back wall must have that same clean effect: **light and a view through it**. For example:
- a row of tall openings or windows between carved pillars, looking out on golden dunes and distant pyramids under a pale
  desert sky;
- or light shafts falling through slots high in the stone.

It should be bright, airy and simple, like the greenhouse glass. Not a dark tomb.

## How it's seen
Inside a building the default view is **close, third person**, about 3x the town's zoomed-in scale, so one art pixel is
about 4 screen pixels. The player can zoom out to the town's view.
- The pieces must look good blown up 3x and still read at the town's scale. The level of detail of the first two shops is
  right.
- **The floor is on screen most of the time, big.** Keep the floor tiles calm: soft, sparse texture, no busy fine
  patterns.
- **Anything drawn as a plan seen from above lies flat** on its squares in the game, like the floor. A tall upright thing
  (a statue, a pillar, an obelisk) must be drawn upright, standing on its foot, not as a plan.

## Read first
- Alfil's pyramid from outside, `packages/app/src/town/houses/alfil.ts`, and Alfil himself,
  `packages/app/src/characters/alfil.ts` (`ALFIL_PALETTE`): his red, blue and gold (the Nettipattam and caparison), the
  sandstone, his browns. Use those colors. The inside must read as the inside of *that* pyramid.
- The Shopkeeper, the baby mammoth: `packages/app/src/characters/sidekicks/alfil.ts` (for size: about 0.9 squares tall
  in the town).
- `packages/app/src/town/houses/kit.ts` (`paint`, `grain`, `groundShadow`, `signFace`, `LightSpot`, `LightPool`,
  `TORCH`).

## The room (columns 0-19 west to east, rows 0-19 north to south; you come in at the south)
```
row 0      the back wall: the bright openings onto the desert (above), the counter's backdrop in the middle
rows 1-4   the shop: counter at columns 8-11, row 3 (the kid stands behind it on row 2)
rows 6-15  the battle circle (below), columns 6-13, rows 7-14
           the statues, the showpiece and the relics round the sides, clear of the paths
row 19     the front: a low stone wall, the entrance (a doorway under a lintel, bright day outside) at columns 9-10
cols 0, 19 side walls: sandstone carved with Egyptian-style etchings (drawn for the west wall; the game mirrors it for
           the east)
```
Keep a path at least 2 squares wide from the door to the counter, and keep the circle walkable. Only the walls, the
counter and the props are solid.

## The battle circle (every building has one)
The middle of each building is a **themed battle circle where future boss battles take place**: a clear, bold arena floor
in the home's theme, like the battle floor of a game's gym.
- **Shape:** an octagon about 8 squares across (columns 6-13, rows 7-14), like the first two.
- **Floor:** polished sandstone or inlaid stone, edged with a carved border (a band of hieroglyph-style marks or a
  lotus-and-scarab frieze, in gold and his blue).
- **Emblem:** a big one in its middle, 2 x 2 squares, for example an elephant's head or the alfil chess piece in a gold
  sun disk.
- **Marks:** a start mark on its north and south sides, and a line across the middle.
- **Feel:** bold and readable from above and from the close camera, calm enough to stand on.
- **Tiles:** draw it as floor tiles, as Puddles' circle was: the plain floor inside, the edge tiles (straight, 45° and
  corner), the line, the start marks and the emblem tiles.

## The pieces (sizes in squares, 1 square = 37 px; heights are a guide)
**Floor** (flat 37 x 37, top-down, no outline, tiles seamlessly):
1. `floor-a`, `floor-b`: sandstone flags in two quiet tones.
2. `floor-c`, `floor-d`: variety: drifted sand in a corner; a cracked flag.
3. The circle's tiles (above).
4. `floor-door`: daylight falling in at the door.

**Walls** (upright):
5. `wall` (1 x about 3.5 squares tall: 37 x ~130): the back wall with its clean, bright view (see above). It tiles side
   by side.
6. `wall-pillar` (1 square wide, a little taller): a carved column (a lotus or papyrus capital, painted bands) in front of
   the wall.
7. `wall-side`, `wall-side-pillar`: the side walls receding, carved with Egyptian-style etchings. Draw elephants and chess
   pieces among the figures, in faded red, blue and gold paint.
8. `hem`, `hem-pillar` and `entrance` (2 squares wide, ~3 tall): the front stays low so it never hides the room. The
   entrance must clearly read as the way out.
9. `backdrop` (4 squares wide, behind the counter): a carved and painted wall panel, or shelves of relics and scrolls,
   under a winged sun disk. Your call.

**The shop and props** (upright, with the town's soft ground shadow):
10. `counter` (4 x 1 squares): a stone counter with a gold-trimmed front and his red and blue cloth, with a blank plaque
    on its front for the game to write on (`SHOP_ALFIL_COUNTER_SIGN = signFace(...)`). **Keep it low, at most about
    32 px tall**, so the baby mammoth, about 0.9 squares tall, shows behind it.
11. `crate` (about 30 x 26 px, on the counter): **Alfil's Boss Crate**, a wooden or stone casket in his style: gold
    corners, a red and blue band, a small elephant or a scarab on the lid. Clearly the thing you buy. Place it at
    `SHOP_ALFIL_CRATE_AT`, in counter pixels, to one side so the plaque stays clear. Idle: a glint.
12. `elephant-statue` (about 2 x 1 squares, **tall, about 150 to 180 px**): the alfil, the old elephant chess piece, as a
    large carved statue on a plinth, in sandstone with gold and his colors. It's the room's landmark. Put it on one side,
    clear of the path.
13. `pharaoh-statue` (1 x 1, ~140 tall): a seated or standing pharaoh-style statue, with an elephant's head if it fits
    him. Not a real pharaoh.
14. `pyramid-model` (1 x 1, ~60 tall): a small golden pyramid on a stand.
15. `relics` (2 x 1, ~60 tall): a low table or chest of shiny relics: gold jars, a scarab, an ankh-style amulet, gems.
    Idle: a glint moving across them.
16. `urns` (1 x 1, ~50 tall): painted canopic jars.
17. **The animated showpiece: your call** (Eric: "not sure what the animated object should be. Opus can think of one").
    - **Size:** make it **big**, about 3 x 2 squares or larger. Eric just asked for bigger showpieces.
    - **Animation:** a real loop of 6 to 8 frames, lively but calm.
    - **Ideas:** a sand-clock fountain pouring golden sand into a basin; a brazier-lit sun disk turning slowly; a
      sarcophagus whose lid glows; a sand river running between little pyramids; an hourglass the size of a person.
    - **Rules:** if part of it lies on the floor (sand or water seen from above), draw that part flat and the upright parts
      upright, as separate layers or pieces, so the game can lay it right.
    - **Notes:** say what you picked and why.
18. Your call: at most two more small things in his spirit. Keep the room uncluttered.

**Lights:** export `SHOP_ALFIL_LIGHTS` (`LightSpot`s) and `SHOP_ALFIL_POOLS` (`LightPool`s) for anything that glows: the
showpiece and any braziers. Each takes a `piece` field naming its piece, with its coordinates in that piece's own pixels,
as Babur's hoops have.

## Looks
Render each piece at 3x or 4x on both backgrounds, then the room still at scale 1.
- Each render must be **one frame** when the picture is wide or tall. A many-image request can't take a picture over
  3,000 px.
- Check that:
  - the floor tiles tile with no seams and stay calm at 4x;
  - the circle reads clearly as a battle floor with its two start marks;
  - the walls tile side by side, and the back wall has the clean, bright view;
  - everything reads as the inside of alfil.ts's pyramid, in his colors;
  - the showpiece's animation loops smoothly;
  - the counter is low enough for the kid to show behind it;
  - the path from the door to the counter is clear.

Call done with notes on your choices, the showpiece and why, and each piece's size in pixels and squares.

## How to write it
Build the file in steps:
1. First `write_drawing` a short skeleton (the palette, the floor tiles, the circle, the wall, the layout and the room
   still) and render it.
2. Then add the other pieces a few at a time with `edit_drawing`, rendering as you go.
3. Keep each turn's writing under about 600 lines.
