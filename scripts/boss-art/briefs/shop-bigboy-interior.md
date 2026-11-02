# Inside Big Boy's Crib: Big Boy's shop

You are drawing a **room**, not a boss: the inside of Big Boy's home on the town square, his giant crib. Big Boy is the
giant baby boss (a teal "BIG BOY" crop shirt, a light blue diaper, a swirly rainbow lollipop; he throws toy blocks). The
player walks up to Big Boy's Crib, taps "Go in", and the view fades into this room, about **20 x 20 squares**, seen the
way the town is seen. Inside, a Shopkeeper stands behind a counter that sells "Big Boy's Boss Crate". The Shopkeeper is
Big Boy's kid, a toddler teddy bear hugging a toy block. The game reuses its sprite, so **don't draw it**.

This is the fourth shop. **Read Alfil's shop first and follow the same structure**:
`scripts/boss-art/out/house-shop-alfil/house-shop-alfil.ts`, with its brief `scripts/boss-art/briefs/shop-alfil-interior.md`.
- one file;
- each piece its own `Character` (`shop-bigboy-<name>`, all in `SHOP_BIGBOY_PIECES`);
- `SHOP_BIGBOY_LAYOUT` (`ShopPlace`, with `w` and `d` for wide and deep pieces);
- the room still, `HOUSE_SHOP_BIGBOY` (id `house-shop-bigboy`), with one viewing animation per piece;
- `SHOP_BIGBOY_COUNTER_SIGN`, `SHOP_BIGBOY_CRATE_AT`, `SHOP_BIGBOY_LIGHTS` and `SHOP_BIGBOY_POOLS` (each light with a
  `piece` field);
- the same footing and the same flat 37 x 37 floor tiles.

Reuse its helpers' ideas, but not its colors.

## Eric's design (Nov 2, his words)
"Room is exactly what you'd expect, the moving piece will be a ceiling toy airplane attached to a string flying in a
circle. The entire floor is a colorful ball pit. The shop and battle circle are built on top of the pit and a walkway
connects everything. Inside the ball pit stuffed animals can be seen, giraffe, tiger, etc, all happy and cuddly looking
but not overly cuddly. Any other ideas for the walls or props feel free to add to fill out the room. The ceiling effect
do whatever you think. Maybe a toy block theme?"

He also likes the clean back walls of the other shops, with a bright view or windows (the greenhouse glass, the pyramid's
openings onto the desert). So keep the back wall bright and clean here too.

## How it's seen
- **Camera:** inside a building the default view is close, third person, about 3x the town's scale, so one art pixel is
  about 4 screen pixels. The player can zoom out to the town's view. The pieces must look good blown up 3x and still read
  at the town's scale.
- **The floor is on screen most of the time, big.** The ball pit is colorful by nature, but keep its tiles calm enough to
  look at: soft shading, a limited number of ball colors per tile, no harsh noise. Make sure the walkway reads clearly as
  where you walk.
- **Anything drawn as a plan from above lies flat** on its squares, like the floor. Anything tall stands upright on its
  foot.

## Read first
- Big Boy's crib from outside: `packages/app/src/town/houses/bigboy.ts`.
- Big Boy himself: `packages/app/src/characters/bigboy.ts` (`BIGBOY_PALETTE`: his toy rainbow `"1"`-`"6"`, whites and
  blues, the teal shirt). Use those colors; the inside must read as the inside of *that* crib.
- The kid: `packages/app/src/characters/sidekicks/bigboy.ts` (about 0.9 squares tall in the town).
- `packages/app/src/town/houses/kit.ts`.

## The room (columns 0-19 west to east, rows 0-19 north to south; you come in at the south)
- **The floor:** everywhere it's a **ball pit**: a sea of colored plastic balls in his rainbow, drawn flat from above as
  floor tiles. Draw two or three tiles that mix without a visible repeat, plus edge tiles where the pit meets a walkway or
  a platform.
- **The walkway:** raised, flat, about 2 squares wide, built of big toy blocks or a soft padded play mat in bright
  squares, with low rails or bumpers. It connects everything:
  - from the door (columns 9-10, row 19) north to the battle circle's south start mark;
  - from the circle's north side on to the shop platform;
  - round to the showpiece and any side props worth walking to.
  - Draw it as flat floor tiles (straight, corners, T or cross pieces as you need), laid by the layout.
  - **Only the walkway, the shop platform and the circle are walkable. The ball pit is not.** The layout marks every pit
    square solid.
- **The shop platform:** rows 1-4, a raised padded platform. The counter is at columns 8-11, row 3, and the kid stands
  behind it on row 2.
- **The battle circle:** columns 6-13, rows 7-14 (an octagon, as in the other shops), raised over the pit (see below).
- **The walls:**
  - row 0 is the back wall;
  - columns 0 and 19 are the side walls (drawn for the west wall; the game mirrors it for the east);
  - row 19 is a low front with the door at columns 9-10.
  - Suggestions, your call: a nursery wallpaper of pastel stripes with a toy-block border; a big bright window with soft
    clouds, or a painted sky with a rainbow; an alphabet frieze of block letters; star decals; a growth chart.
- **The ceiling:** the game draws the ceiling. Give the walls a top band that suits a toy-block or cloud-and-star theme
  so it can follow on.

## The battle circle
- **Shape and surface:** a round play mat, about 8 squares across, raised on giant toy blocks so it sits above the balls.
  A bold arena floor in his rainbow, like a game's gym floor.
- **Edge:** a soft padded bumper, in alternating colors.
- **Emblem:** a big one in the middle, 2 x 2 squares: his lollipop swirl, or a rattle or a block with a "B".
- **Marks:** a start mark on the north and south sides (where two sides would stand), and a line across the middle.
- **Feel:** readable from above and from the close camera, and calm enough to stand on.
- **Tiles:** draw it as floor tiles, as Alfil's circle was.

## The pieces (sizes in squares, 1 square = 37 px; heights are a guide)
**Floor** (flat 37 x 37, top-down, no outline):
1. `pit-a`, `pit-b`, `pit-c`: the ball pit.
2. The pit's edges against the walkway and the platforms.
3. The walkway tiles.
4. The circle's tiles.
5. `floor-door`: the door's mat.

**In the pit:** happy, cuddly stuffed animals half sunk among the balls. A giraffe's long neck and head poking up, a
tiger, a bear, an elephant, a duck, a bunny: about 5 to 7 of them, spread round the room.
- **Look:** cute and friendly, with stitched seams, button eyes and soft colors, but not overly cute.
- **How:** each is an upright piece standing on its square, its bottom hidden by a little heap of balls drawn in front of
  it.
- **Sizes:** about 30 to 70 px tall; the giraffe is the tallest.
- Name them `plush-giraffe`, `plush-tiger`, and so on.

**Walls** (upright):
6. `wall` (37 x about 130) and a variant if you like. `wall-window` or `wall-feature` (one or more squares wide): the
   bright window or the painted sky.
7. `wall-pillar`: a tall stack of toy blocks as the corner and middle posts.
8. `wall-side`, `wall-side-pillar`: the side walls receding.
9. `hem`, `hem-pillar` and `entrance` (2 squares wide, ~3 tall): the front stays low. The entrance (a door with a round
   window, or a gate in the crib's bars) must clearly read as the way out.
10. `backdrop` (4 squares wide, behind the counter): shelves of toys, or a giant toy chest with its lid open.

**The shop and props** (upright, with the town's soft ground shadow):
11. `counter` (4 x 1): a counter of stacked toy blocks with letters on their fronts, with a blank plaque for the game to
    write on (`SHOP_BIGBOY_COUNTER_SIGN`). **Keep it low, at most about 32 px tall**, so the teddy kid shows behind it.
12. `crate` (about 30 x 26 px, on the counter): **Big Boy's Boss Crate**, a toy box in his rainbow with a lollipop or a
    rattle on the lid. Clearly the thing you buy. Idle: a glint.
13. **`airplane`, the animated showpiece** (Eric: "a ceiling toy airplane attached to a string flying in a circle"):
    - **What:** a bright toy propeller plane hanging on a string from the ceiling, flying round and round in a wide
      circle, about 2 to 3 squares across, above the pit beside the circle (for example over columns 15-17, rows 8-10).
    - **The string:** goes straight up off the top of the picture to the ceiling.
    - **Draw it upright,** as seen by the town's camera looking north: the plane goes round an ellipse. Draw it side-on at
      the left and right of the loop, from behind as it flies away, and nose-on as it comes toward you; smaller and a
      little higher at the back of the loop, bigger at the front. The string swings with it. Its propeller spins.
    - **Frames:** **12 to 16 frames** for one smooth loop, about 90 ms each.
    - **Ground:** a soft round shadow on the balls below follows it round.
    - **Size:** about 3 x 3 squares (111 x ~180 px).
    - It's the room's eye-catcher.
14. Your call, 4 to 6 more things in his spirit to fill out the room, clear of the walkway. Ideas:
    - a rocking horse;
    - a stack of giant blocks spelling B-I-G;
    - a toy train;
    - a rattle;
    - a beach ball;
    - a rubber-duck float in the pit;
    - a mobile;
    - a bouncy chair;
    - a toy chest.

## Looks
Render each piece at 3x or 4x on both backgrounds, then the room still at scale 1.
- **One frame only** for wide or tall pictures: a many-image request can't take a picture over 3,000 px.
- Check that:
  - the ball pit tiles mix with no visible repeat and stay calm at 4x;
  - the walkway clearly reads as the path and connects the door, the circle, the shop and the showpiece;
  - the circle reads as a battle floor with its two start marks;
  - the plane's loop is smooth;
  - the counter is low enough for the kid to show behind it;
  - everything reads as the inside of bigboy.ts's crib, in his colors.

Call done with notes on your choices and each piece's size in pixels and squares.

## How to write it
Build the file in steps:
1. First `write_drawing` a short skeleton (the palette, the pit, the walkway, the circle, the wall, the layout and the
   room still) and render it.
2. Then add the other pieces a few at a time with `edit_drawing`, rendering as you go.
3. Keep each turn's writing under about 600 lines.
