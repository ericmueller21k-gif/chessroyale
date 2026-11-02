# Inside Babur's circus tent: Babur's shop

You are drawing a **room**, not a boss: the inside of Babur's home on the town square, a circus big top. In the game the
player walks up to Babur's Circus, taps "Go in", and the view zooms and fades into this room, about **20 x 20 squares**,
seen exactly the way the town square is seen. Inside, a Shopkeeper (Stripes, Babur's kid: the game reuses its existing
sprite, so **don't draw Stripes**) stands behind a counter that sells "Babur's Boss Crate". The game's code (written later
by another helper) lays your pieces out; you draw the pieces and a still of them laid out.

Same sprite format as the bosses (`Character`), but still pictures (an `idle` of one frame; a few pieces may have a gentle
2 to 4 frame idle, see below). The render tool's boss checks don't apply (your id starts with `house-`).

## Read first
- How the town is seen: `docs/areas/town-square.md` ("The camera", "The park"). The camera always looks **north**, pitched
  down over a ground of squares; every thing stands **upright facing the camera**, its foot on the middle of its square
  (a wide thing's foot: the middle of its front edge), drawn far (north) to near (south). **37 pixels is one square** at the
  homes' scale. The ground is flat squares in two alternating tones (the board's `#eec58b` / `#ad8058`, the park's paving
  `#ded6c6` / `#cbc2b1`, grass `#80b854` / `#71aa4a`).
- How the town's pictures are drawn: `packages/app/src/town/houses/kit.ts` (`paint`, `grain`, `groundShadow`, `ball`,
  `crate`, `lantern`) and `packages/app/src/town/houses/park.ts` (the closest model: separate props at the 37 px scale,
  each its own `Character`, foot on its square).
- **Babur's tent from outside**: `packages/app/src/town/houses/tiger.ts`. Use its palette, value for value (the tent's
  reds A/B/C and whites D/E/F, flag blues G/H/I, golds J-M, woods N-Q, the balloons' greens X-Z, purples a-c, yellows
  d-f, outline k). The inside must read as the inside of *that* tent.
- Babur himself: `packages/app/src/characters/tiger.ts` (a retired circus tiger who twists balloon chess pieces; he quit
  the fire-hoop act for good, so **no fire anywhere**).

Import from the repo with paths relative to your file (`../../../../packages/app/src/town/houses/kit.ts`,
`../../../../packages/app/src/characters/sprite.ts`).

## The room (columns 0-19 west to east, rows 0-19 north to south; you come in at the south)
```
row 0      back wall (striped canvas), the counter's backdrop in the middle
rows 1-4   the shop: counter at columns 8-11, row 3 (Stripes stands behind it on row 2)
           balloon-twisting stand at 2-3, row 3; cold hoop stand at 16, row 3
rows 6-15  the ring: an octagon about 8 x 8 (columns 6-13, rows 7-14), the pedestal in its middle
           balloon chess stack at 3, row 12; a second small stack or pedestal at 16, row 12 (your call)
row 19     the front: a low hem of canvas, the entrance flap at columns 9-10 (the way out)
cols 0, 19 side walls, a tent pole at each corner and one halfway along each side
```
Keep the walkable space clear: a path at least 2 squares wide from the entrance up to the counter (through the ring or
round it), and the ring itself walkable. Only the walls, the counter and the props are solid.

## The pieces (each its own exported `Character`, id `shop-babur-<name>`, foot on its square)
Sizes are in squares (1 square = 37 px); heights are a guide.

**The floor** (flat tiles, 37 x 37, drawn **top-down** as the game's ground squares are, no outline, no shadow: they
lie on the ground and tile seamlessly):
1. `floor-a`, `floor-b`: sawdust, the two alternating tones (warm pale straw over the board's tan; a few specks of
   grain, quiet enough to tile 400 times without a pattern showing).
2. `floor-c`, `floor-d`: variety, used now and then: a few wood shavings and a dropped balloon scrap (a curl of color);
   a faint scuffed footpath.
3. `ring-a`, `ring-b`: the ring's floor, raked darker sawdust (a little redder), alternating.
4. `ring-edge`, `ring-edge-diag`: the ring's curb seen from above: a painted band (red and white blocks, the tent's
   stripes) with a 2 px lip, ring floor on one side, sawdust on the other. One straight (the band along the tile's
   north side; the game turns it) and one for the octagon's 45-degree sides.
5. `floor-door`: the daylight spilling in at the entrance, a soft warm wedge on sawdust (1 x 1, used on the two squares
   inside the flap).

**The walls** (upright, foot on the wall's squares):
6. `wall` (1 x about 3.5 squares tall: 37 x ~130): the striped canvas seen from inside: vertical red and white stripes
   (one stripe pair a square, so pieces tile side by side), the inside shaded a little darker than outside, a gold-trimmed
   scalloped valance at the top, bunting (the balloons' blue, green, purple, yellow pennants on a string) along it. Tiles
   seamlessly left to right.
7. `wall-pole` (1 square wide, a little taller): a wall piece with a wooden tent pole in front, gold cap, a rope tie.
8. `wall-side` (1 square, ~130 tall): the side walls run north-south, seen obliquely; draw the canvas as narrow
   receding folds (the stripes foreshortened), so a column of them reads as a wall going away from you. Draw it for the
   west side; the game mirrors it for the east.
9. `hem` (1 x ~0.5 square tall) and `entrance` (2 squares wide, ~3 tall): the front (south) wall stays low so it never
   hides the room: a short striped hem; at columns 9-10 the entrance, the two curtain halves tied back with gold rope
   and bright day outside between them. This is the way out: make it clearly read as a door.

**The shop and the props** (upright, each with the town's soft ground shadow):
10. `counter` (4 x 1 squares: 148 wide, ~56 tall): a circus ticket-booth counter: a wooden top, its front panel painted
    in the tent's red with gold trim and a row of gold stars or bulbs (unlit bulbs, no glow), a blank little sign plaque
    on its front (no letters: the game writes on it). Export its plaque's face like the homes' signs
    (`SHOP_BABUR_COUNTER_SIGN = signFace(...)`).
11. `crate` (about 30 x 26 px, stands on the counter): **Babur's Boss Crate**, a wooden crate (kit `crate`) in Babur's
    style: red bands, gold corners, a balloon knot or a tiger stripe on its lid, a little special so it reads as the thing
    you buy. Export its spot on the counter (`SHOP_BABUR_CRATE_AT`, counter pixels).
12. `balloon-stand` (2 x 1 squares, ~95 tall): Babur's balloon-twisting stand: a small wooden cart or table, a pump,
    long uninflated balloons hanging in colors, and a few finished balloons tied above it bobbing (idle: 4 frames,
    a 1 px bob, out of step).
13. `hoop-stand` (1 x 1, ~85 tall): an old circus hoop on a stand, **cold**: no fire, no soot glow; plain gold hoop,
    maybe a ribbon tied on it, retired for good. Still.
14. `balloon-stack` (1 x 1, ~60 tall): a small stack of finished balloon chess pieces (a knight, a rook, a pawn, a
    bishop, in the balloons' colors, the way Babur's balloons look in his boss art), heaped on a low crate or each other.
15. `pedestal` (1 x 1, ~70 tall): a round circus pedestal (the tiger's drum, red and gold) in the ring's middle, a big
    balloon king standing on it, Babur's centerpiece.
16. Your call, at most two more small things in the same spirit (a juggling-pin rack, a trunk of costumes, a ringmaster
    stool), each 1 x 1. Keep the room uncluttered.

## The room still
Also export `HOUSE_SHOP_BABUR: Character` (id `house-shop-babur`): its `idle` is the **whole 20 x 20 room laid out** as
one still (one frame), for review and for the code helper: the floor tiles flat on their squares (740 x 740 px, a plain
top-down plan), each upright piece stood at its foot with its picture rising above it (north things drawn first), the
back wall's pictures rising above row 0. Give it one extra animation per piece, named after the piece (`counter`,
`wall`, `floor-a`, ...), showing that piece alone, so you can render each at 4x. And export `SHOP_BABUR_LAYOUT`: for each
placed piece, its name, column, row and whether it's solid, so the code helper can lay the room out from it.

## Looks
Render each piece at 3x or 4x on both backgrounds, then the room still (scale 1). Check: the floor tiles tile without
seams or a visible repeat; the walls tile side by side; everything reads as the inside of tiger.ts's tent in its colors;
nothing is on fire; the path from the door to the counter is clear. Call done with notes on your choices and each piece's
size in pixels and squares.
