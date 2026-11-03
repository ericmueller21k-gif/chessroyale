# Inside Timber's Lumber Lodge: Timber's shop

You are drawing a **room**, not a boss: the inside of Timber's home on the town square, a lumber lodge and woodshop.
Timber is the beaver builder boss (an orange hard hat and safety vest, a yellow tool belt, a red-handled hammer, planks
on his back). The player walks up to his home, taps "Go in", and the view fades into this room, about **20 x 20
squares**, seen the way the town is seen. Inside, a Shopkeeper stands behind a counter that sells "Timber's Boss Crate".
The Shopkeeper is Rivet, Timber's kid, a little woodpecker foreman in an orange hard hat. The game reuses his sprite, so
**don't draw him**.

This is the fifth shop. **Read Alfil's shop first and follow the same structure**:
`scripts/boss-art/out/house-shop-alfil/house-shop-alfil.ts`, with its brief `scripts/boss-art/briefs/shop-alfil-interior.md`.
Big Boy's second pass shows the newest battle circle: `scripts/boss-art/out/house-shop-bigboy/house-shop-bigboy.ts`
(`SHOP_BIGBOY_MARKS`).
- **One file.**
- **Pieces:** each is its own `Character` (`shop-timber-<name>`, all in `SHOP_TIMBER_PIECES`).
- **Layout:** `SHOP_TIMBER_LAYOUT` (`ShopPlace`, with `w` and `d` for wide and deep pieces).
- **Room still:** `HOUSE_SHOP_TIMBER` (id `house-shop-timber`), with one viewing animation per piece.
- **Other exports:** `SHOP_TIMBER_COUNTER_SIGN`, `SHOP_TIMBER_CRATE_AT`, `SHOP_TIMBER_MARKS`, `SHOP_TIMBER_LIGHTS` and
  `SHOP_TIMBER_POOLS` (each light with a `piece` field).
- **Footing and floor:** the same footing and the same flat 37 x 37 floor tiles as Alfil's shop.

Reuse its helpers' ideas, but not its colors.

## Eric's design (Nov 3, his words)
"A lumber theme… lumber boards on the walls… behind the counter, some finished-looking wood and also the more raw,
lighter-colored wood. Add some finished chess pieces, big wooden chess pieces and some smaller ones (pawns, a queen, a
king), finished in a varnish look, and some unfinished ones too (ones he's still carving). It'd be funny to put little
signs next to the finished ones: a FOR SALE sign like the ones on a house's lawn."

The animated showpiece: "I'm not sure… have the worker give suggestions; the chess pieces he's building or carving is a
cool idea." So **you pick it, and say why**.

Eric also likes every shop's clean, bright back wall (the greenhouse's glass, the pyramid's openings onto the desert, the
nursery's big windows). Keep it here too: for example, big windows between log posts looking out on a pine forest and a
river with a beaver dam.

## How it's seen
- **Camera:** inside a building the default view is close, third person, about 3x the town's scale, so one art pixel is
  about 4 screen pixels. The player can zoom out to the town's view. Pieces must look good blown up 3x and still read at
  the town's scale.
- **The floor is on screen most of the time, big.** Keep the floor tiles calm: wide planks with soft grain and a few
  knots, no busy fine patterns.
- **Flat and upright:** anything drawn as a plan from above lies flat on its squares, like the floor. Anything tall
  stands upright on its foot.

## Read first
- Timber: `scripts/boss-art/out/boss-beaver/boss-beaver.ts` (its `PALETTE`: his browns, orange, yellow, red, the plank
  wood).
- His kid Rivet: `packages/app/src/characters/sidekicks/timber.ts` (about 0.9 squares tall in the town).
- His home from outside, if it's drawn by the time you run: `scripts/boss-art/out/house-timber/house-timber.ts`. The
  inside should match it.
- `packages/app/src/town/houses/kit.ts`.

## The room (columns 0-19 west to east, rows 0-19 north to south; you come in at the south)
```
row 0      the back wall: the bright windows (above), the counter's backdrop in the middle
rows 1-4   the shop: counter at columns 8-11, row 3 (Rivet stands behind it on row 2)
rows 6-15  the battle circle (below), columns 6-13, rows 7-14
           the chess pieces, the showpiece and the lumber round the sides, clear of the paths
row 19     the front: a low log wall, the door (a plank door standing open, daylight outside) at columns 9-10
cols 0, 19 side walls of plank boards (drawn for the west wall; the game mirrors it for the east)
```
Keep a path at least 2 squares wide from the door to the counter, and keep the circle walkable. Only the walls, the
counter and the props are solid.

## The battle circle
The middle of each home is a **themed battle circle where boss battles take place**, a clear, bold arena floor in the
home's theme, like a game's gym floor.
- **Shape and surface:** an octagon about 8 squares across (columns 6-13, rows 7-14). Its floor is a big round of polished
  end grain, like the top of a giant sawn log with growth rings, or a parquet of varnished wood.
- **Edge:** a border of bark, or of a rope coil.
- **Emblem:** a 2 x 2 emblem in the middle, where the table stands, for example a hammer crossed with a saw, or a beaver
  tooth.
- **The two start marks:** **on the west (the boss) and the east (you)** sides, on the middle line. Each is centered
  1.5 squares from the center: the middle of column 8 and of column 11, on the line between rows 10 and 11. Export
  `SHOP_TIMBER_MARKS = { boss: [8, 10.5], you: [11, 10.5] }`, as Big Boy's.
- **No north and south marks.** A line across the middle is optional; if there's one, it runs north to south.
- **Tiles:** draw it as floor tiles, as Alfil's and Big Boy's circles were.

## The pieces (sizes in squares, 1 square = 37 px; heights are a guide)
**Floor** (flat 37 x 37, top-down, no outline): `floor-a`, `floor-b` (wide planks), `floor-c`, `floor-d` (variety:
sawdust, a knot, shavings), the circle's tiles, and `floor-door`.

**Walls** (upright):
- `wall` (37 x ~130): plank boards with the bright windows.
- `wall-pillar`: a log post.
- `wall-side` and `wall-side-pillar`: the side walls receding, plank boards with tools hung on pegs.
- `hem`, `hem-pillar` and `entrance` (2 squares wide, ~3 tall): the front stays low. The entrance must clearly read as
  the way out.
- `backdrop` (4 squares wide, behind the counter): **finished, varnished wood and raw, lighter wood** (Eric's words). For
  example shelves of polished boards and stacked raw planks, with a saw and a level hung up.

**The shop and props** (upright, with the town's soft ground shadow):
- `counter` (4 x 1): a sturdy workbench counter of varnished planks, with a vise, and a blank plaque for the game to write
  on (`SHOP_TIMBER_COUNTER_SIGN`). **Keep it low, at most about 32 px tall**, so the little woodpecker shows behind it.
- `crate` (about 30 x 26 px, on the counter): **Timber's Boss Crate**, a sturdy wooden crate with orange safety straps
  and a beaver tooth or a hammer on the lid. Clearly the thing you buy. Idle: a glint.
- **Chess pieces, finished and for sale:** varnished wooden chess pieces that shine. Add a little **FOR SALE sign** beside
  each finished piece or group: a small lawn sign on a stake, red and white like a real estate sign, its words drawn as
  tiny pixel letters or shapes that read as "FOR SALE". Include:
  - **a few big ones** standing on the floor, 1 to 2 squares tall: a king, a queen, a knight;
  - **some smaller ones** (pawns, a queen, a king) on a low display table or a shelf.
- **Chess pieces, unfinished:** pieces he's still carving: rough, lighter raw wood, half-shaped, with chisel marks, maybe
  one still part of a log, and shavings round them.
- **The animated showpiece (your call; Eric: "the chess pieces he's building or carving is a cool idea"):**
  - **Size:** make it **big**, about 3 x 2 squares or more; Eric asked for bigger showpieces.
  - **Loop:** 8 to 12 frames, lively but calm.
  - **Ideas:** a wood lathe turning a giant pawn, with shavings curling off; a half-carved giant king on a carving stand
    with a mallet and chisel tapping by themselves and chips flying; a sawmill blade with a log feeding through.
  - **Notes:** say what you picked and why.
- **Lumber:** stacks of planks and logs, a sawhorse, a chopping block, a toolbox: enough to fill the room without
  crowding the paths.

## Looks
Render each piece at 3x or 4x on both backgrounds, then the room still at scale 1.
- **One frame only** for wide or tall pictures: a many-image request can't take a picture over 3,000 px.
- Check that:
  - the floor tiles tile with no seams and stay calm at 4x;
  - the circle reads as a battle floor with its west and east marks;
  - the walls tile, and the back wall has the clean, bright view;
  - the FOR SALE signs read;
  - the showpiece loops smoothly;
  - the counter is low enough for the woodpecker to show behind it;
  - the path from the door to the counter is clear.

Call done with notes on your choices, the showpiece and why, and each piece's size in pixels and squares.

## How to write it
Build the file in steps:
1. First `write_drawing` a short skeleton (the palette, the floor tiles, the circle, the wall, the layout and the room
   still) and render it.
2. Then add the other pieces a few at a time with `edit_drawing`, rendering as you go.
3. Keep each turn's writing under about 600 lines.
